package com.luban.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luban.backend.dto.LeadResponse;
import com.luban.backend.dto.LeadSubmitRequest;
import com.luban.backend.dto.LeadSubmitResult;
import com.luban.backend.entity.Form;
import com.luban.backend.entity.Lead;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.FormMapper;
import com.luban.backend.mapper.LeadMapper;
import com.luban.backend.mapper.SiteMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Lead 线索领域服务：留资提交编排（防刷→去重→加密→入库→通知）+ 线索中心读写 + 导出。
 * 编排逻辑通过 mock mapper/service 单测覆盖；DB 真实交互由集成测试覆盖。
 */
@Service
public class LeadService {

    /** 防刷默认值（form 未配置 antiSpamJson 或配置非法时回退，close-tech-debt-1 3.1）。 */
    static final int DEFAULT_RATE_MAX = 5;
    static final int DEFAULT_RATE_WINDOW_SEC = 60;
    private static final List<String> DEFAULT_DEDUP_KEYS = List.of("phone");

    private final FormMapper formMapper;
    private final LeadMapper leadMapper;
    private final SiteMapper siteMapper;
    private final SiteOwnershipGuard ownershipGuard;
    private final QuotaService quotaService;
    private final FeatureGateService featureGateService;
    private final DedupService dedupService;
    private final AntiSpamService antiSpamService;
    private final LeadCryptoService cryptoService;
    private final LeadStatusMachine statusMachine;
    private final LeadNotifyService notifyService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LeadService(FormMapper formMapper, LeadMapper leadMapper, SiteMapper siteMapper,
                       SiteOwnershipGuard ownershipGuard, QuotaService quotaService,
                       FeatureGateService featureGateService, DedupService dedupService,
                       AntiSpamService antiSpamService, LeadCryptoService cryptoService,
                       LeadStatusMachine statusMachine, LeadNotifyService notifyService) {
        this.formMapper = formMapper;
        this.leadMapper = leadMapper;
        this.siteMapper = siteMapper;
        this.ownershipGuard = ownershipGuard;
        this.quotaService = quotaService;
        this.featureGateService = featureGateService;
        this.dedupService = dedupService;
        this.antiSpamService = antiSpamService;
        this.cryptoService = cryptoService;
        this.statusMachine = statusMachine;
        this.notifyService = notifyService;
    }

    /**
     * 留资提交（公开入口核心编排）。
     *
     * @throws BusinessException FORM_NOT_FOUND / LEAD_SPAM_BLOCKED / LEAD_DUPLICATE / LEAD_DISABLED（lead_capture gate 关闭）
     */
    @Transactional(rollbackFor = Exception.class)
    public LeadSubmitResult submit(LeadSubmitRequest req) {
        Form form = formMapper.getById(req.formId());
        if (form == null) {
            throw BusinessException.formNotFound();
        }
        if (!"active".equals(form.getStatus())) {
            throw BusinessException.leadDisabled();
        }

        // 0. site 级 lead_capture gate（wire-e2e-feature-gaps D1：关闭 → LEAD_DISABLED，
        //    fail-open——无配置放行）。siteId 在此处已知（form 已加载），故检查放 service 层
        //    而非 controller（避免 PublicLeadController 重复查 form）。
        if (!featureGateService.isEnabled(form.getSiteId(), FeatureGateService.KEY_LEAD_CAPTURE)) {
            throw BusinessException.leadDisabled();
        }

        // 1. 防刷（IP + form 维度；阈值/窗口取自 form.antiSpamJson，缺省/非法回退 5 次/60s）
        AntiSpamConfig antiSpam = parseAntiSpamConfig(form);
        if (antiSpamService.isRateLimited(req.ip(), req.formId(), antiSpam.max(), antiSpam.windowSeconds())) {
            throw BusinessException.leadSpamBlocked();
        }

        // 2. 去重
        List<String> dedupKeys = parseDedupKeys(form);
        String hash = dedupService.computeHash(req.formId(), req.contact(), dedupKeys);
        Instant dedupThreshold = Instant.now().minus(form.getDedupWindow(), ChronoUnit.SECONDS);
        int exists = leadMapper.countByFormHashInWindow(req.formId(), hash, dedupThreshold);
        DedupService.Policy policy = parsePolicy(form);
        DedupService.Decision decision = dedupService.decide(exists > 0, policy);
        if (decision == DedupService.Decision.REJECT) {
            throw BusinessException.leadDuplicate();
        }

        // MERGE：全局查同指纹线索（uk_form_dedup 唯一；含窗口外——窗口过期后同 phone 提交若 insert 会撞全局 uk 500），
        // 命中则 update 合并，未命中（从未提交过）才走 insert
        if (policy == DedupService.Policy.MERGE) {
            Lead existing = leadMapper.findLatestByFormHash(req.formId(), hash);
            if (existing != null) {
                return mergeExistingLead(form, req, hash, existing);
            }
        }

        // 3. 加密 contact + 构建 lead（T-be-5：按 site→owner 先查限后累加 leads 配额，
        //    拦截在累加前；owner=NULL 平台站点不限；MERGE 命中路径不产生新 lead 不计数）
        String quotaOwner = resolveQuotaOwner(form.getSiteId());
        if (quotaOwner != null) {
            quotaService.checkAndIncrement(quotaOwner, QuotaService.METRIC_LEADS);
        }
        String encryptedContact = cryptoService.encrypt(toJson(req.contact()));
        Lead lead = new Lead();
        lead.setId(UUID.randomUUID().toString());
        lead.setSiteId(form.getSiteId());
        lead.setFormId(form.getId());
        lead.setPageId(req.pageId() != null ? req.pageId() : form.getPageId());
        lead.setContactJson(encryptedContact);
        lead.setUtmJson(toJson(req.utm()));
        lead.setStatus(decision == DedupService.Decision.MARK_DUPLICATE
                ? LeadStatusMachine.Status.INVALID.name().toLowerCase()
                : LeadStatusMachine.Status.NEW.name().toLowerCase());
        lead.setDedupHash(hash);
        lead.setSourceIp(req.ip());
        lead.setVisitorId(req.visitorId());
        Instant now = Instant.now();
        lead.setCreatedAt(now);
        lead.setUpdatedAt(now);
        try {
            leadMapper.insert(lead);
        } catch (DataIntegrityViolationException e) {
            // 并发竞态（如双击双发）：check-then-insert 之间另一请求已插入同指纹 lead，
            // insert 撞 uk_form_dedup 唯一键 → 按去重策略收敛为幂等结果，不再冒泡 500
            if (!isUniqueViolation(e)) throw e;
            LeadSubmitResult converged = onConcurrentDuplicate(form, req, hash, policy);
            // 收敛路径复用既有 lead，未产生新行：回退第 3 步的 leads 配额累加
            //（REJECT 抛 409 LEAD_DUPLICATE 时不会走到这里，事务整体回滚同样不残留计数）
            if (quotaOwner != null) {
                quotaService.decrement(quotaOwner, QuotaService.METRIC_LEADS);
            }
            return converged;
        }

        // 4. 通知（失败不阻塞主流程）
        notifyService.notifyNewLead(lead, form);

        return new LeadSubmitResult(lead.getId(), lead.getStatus(), exists > 0);
    }

    /**
     * 唯一键冲突后的幂等收敛（并发重复提交/窗口过期重复指纹）：
     * REJECT → 409 LEAD_DUPLICATE；MERGE → 走既有 findLatestByFormHash 合并路径；
     * MARK → 返回既有 lead 当前态（dedup=true）。返回前不触发通知（与 MERGE 语义一致）。
     */
    private LeadSubmitResult onConcurrentDuplicate(Form form, LeadSubmitRequest req, String hash,
                                                   DedupService.Policy policy) {
        Lead existing = leadMapper.findLatestByFormHash(req.formId(), hash);
        if (existing == null) {
            // 理论不可达（唯一键冲突意味着必有同指纹行）；防御性兜底为去重响应
            throw BusinessException.leadDuplicate();
        }
        if (policy == DedupService.Policy.MERGE) {
            return mergeExistingLead(form, req, hash, existing);
        }
        if (policy == DedupService.Policy.MARK) {
            return new LeadSubmitResult(existing.getId(), existing.getStatus(), true);
        }
        // REJECT / OVERWRITE：返回去重响应（409），不再 500
        throw BusinessException.leadDuplicate();
    }

    /** 与 SiteService.isUniqueViolation 同口径：MySQL "Duplicate entry" / H2 "Unique index or primary key violation"。 */
    private static boolean isUniqueViolation(DataIntegrityViolationException e) {
        if (e == null || e.getMessage() == null) return false;
        String m = e.getMessage();
        return m.contains("Duplicate") || m.contains("Unique index") || m.contains("primary key violation");
    }

    /**
     * MERGE 去重：命中窗口内同指纹线索时，合并新 contact 到现有 lead（update）而非 insert。
     * 合并语义：新 contact 字段覆盖同名旧字段，旧独有字段保留。contact 合并后重新加密。
     * 乐观锁 updated_at：并发重复提交影响 0 行则返回当前态（last-writer-wins，后到提交独有字段可能丢失，保证幂等不抛 500）。
     * MERGE 不重复触发通知。existing 由调用方全局查询传入（含窗口外，避免 uk 冲突）。
     */
    private LeadSubmitResult mergeExistingLead(Form form, LeadSubmitRequest req, String hash, Lead existing) {
        Map<String, String> merged = new LinkedHashMap<>(decryptContact(existing));
        if (req.contact() != null) {
            merged.putAll(req.contact()); // 新字段覆盖同名，旧独有字段保留
        }
        String encrypted = cryptoService.encrypt(toJson(merged));
        int rows = leadMapper.updateContactByDedup(form.getId(), hash, encrypted,
                existing.getUpdatedAt(), Instant.now());
        if (rows == 0) {
            // 乐观锁冲突（并发 merge）：返回当前态，保证幂等不报错
            return new LeadSubmitResult(existing.getId(), existing.getStatus(), true);
        }
        return new LeadSubmitResult(existing.getId(), existing.getStatus(), true);
    }

    /** 线索中心：列表（分页 + 筛选，contact 脱敏）。读入口守卫：仅站点 owner/admin 可见。 */
    public Map<String, Object> list(String siteId, String status, String formId, String assigneeId, int page, int size) {
        ownershipGuard.assertVisible(siteId);
        int offset = Math.max(0, (page - 1) * size);
        List<Lead> leads = leadMapper.listByQuery(siteId, status, formId, assigneeId, offset, size);
        int total = leadMapper.countByQuery(siteId, status, formId, assigneeId);
        List<LeadResponse> respList = leads.stream().map(this::toResponse).toList();
        return Map.of("list", respList, "total", total, "page", page, "pageSize", size);
    }

    public LeadResponse get(String siteId, String leadId) {
        ownershipGuard.assertVisible(siteId);
        return toResponse(getOrThrow(siteId, leadId));
    }

    @Transactional(rollbackFor = Exception.class)
    public LeadResponse transitStatus(String siteId, String leadId, String toStatusRaw, String actorId) {
        ownershipGuard.assertCanWrite(siteId);
        Lead lead = getOrThrow(siteId, leadId);
        LeadStatusMachine.Status from = statusMachine.parse(lead.getStatus());
        LeadStatusMachine.Status to = statusMachine.parse(toStatusRaw);
        statusMachine.ensureValid(from, to);
        Instant now = Instant.now();
        Instant convertedAt = to == LeadStatusMachine.Status.CONVERTED ? now : lead.getConvertedAt();
        String assignee = (to == LeadStatusMachine.Status.ASSIGNED && actorId != null) ? actorId : lead.getAssigneeId();
        leadMapper.updateStatus(leadId, siteId, to.name().toLowerCase(), assignee, convertedAt, now);
        lead.setStatus(to.name().toLowerCase());
        lead.setAssigneeId(assignee);
        lead.setConvertedAt(convertedAt);
        return toResponse(lead);
    }

    /** 导出 CSV（contact 明文，权限由 BFF 保证；销售/运营跟进需明文）。 */
    public String exportCsv(String siteId) {
        List<Lead> leads = leadMapper.listAllForExport(siteId);
        StringBuilder sb = new StringBuilder();
        sb.append("phone,email,name,status,created_at\n");
        for (Lead l : leads) {
            Map<String, String> contact = decryptContact(l);
            sb.append(csv(contact.get("phone"))).append(',')
                    .append(csv(contact.get("email"))).append(',')
                    .append(csv(contact.get("name"))).append(',')
                    .append(csv(l.getStatus())).append(',')
                    .append(csv(l.getCreatedAt() != null ? l.getCreatedAt().toString() : "")).append('\n');
        }
        return sb.toString();
    }

    private Lead getOrThrow(String siteId, String leadId) {
        Lead lead = leadMapper.getByIdAndSiteId(leadId, siteId);
        if (lead == null) throw BusinessException.leadNotFound();
        return lead;
    }

    /** 配额归属：site→owner（平台站点 owner=NULL 不限，由管理员/平台承担）。 */
    private String resolveQuotaOwner(String siteId) {
        if (siteId == null) return null;
        com.luban.backend.entity.Site site = siteMapper.getById(siteId);
        return site != null ? site.getOwnerUserId() : null;
    }

    /** 转响应：contact 解密后脱敏（phone/email）。 */
    public LeadResponse toResponse(Lead lead) {
        Map<String, String> masked = new LinkedHashMap<>();
        Map<String, String> contact = decryptContact(lead);
        for (Map.Entry<String, String> e : contact.entrySet()) {
            String k = e.getKey();
            String v = e.getValue();
            if ("phone".equalsIgnoreCase(k)) masked.put(k, cryptoService.maskPhone(v));
            else if ("email".equalsIgnoreCase(k)) masked.put(k, cryptoService.maskEmail(v));
            else masked.put(k, v);
        }
        Map<String, String> utm = null;
        if (lead.getUtmJson() != null && !lead.getUtmJson().isBlank()) {
            try {
                utm = objectMapper.readValue(lead.getUtmJson(), Map.class);
            } catch (Exception ignored) {
            }
        }
        String formName = null;
        if (lead.getFormId() != null) {
            Form f = formMapper.getById(lead.getFormId());
            if (f != null) formName = f.getName();
        }
        return new LeadResponse(lead.getId(), lead.getSiteId(), lead.getFormId(), lead.getPageId(),
                lead.getChannelId(), masked, utm, lead.getStatus(), lead.getAssigneeId(), lead.getSourceIp(),
                lead.getCreatedAt(), lead.getUpdatedAt(), lead.getConvertedAt(), formName);
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> decryptContact(Lead lead) {
        if (lead.getContactJson() == null || lead.getContactJson().isBlank()) return Map.of();
        try {
            String plain = cryptoService.decrypt(lead.getContactJson());
            return objectMapper.readValue(plain, Map.class);
        } catch (Exception e) {
            return Map.of();
        }
    }

    /** 防刷参数（form.antiSpamJson 的 {max, windowSeconds}）。 */
    record AntiSpamConfig(int max, int windowSeconds) {
        static final AntiSpamConfig DEFAULT =
                new AntiSpamConfig(DEFAULT_RATE_MAX, DEFAULT_RATE_WINDOW_SEC);
    }

    /**
     * 解析 form.antiSpamJson（FormService.create/update 已持久化）：
     * null/空/非法 JSON/任一字段非正 → 整体回退默认 5 次/60s（与 parseDedupKeys 的容错口径一致，
     * 配置错误不阻断正常提交）。字段缺失时逐字段回退默认值。
     */
    private AntiSpamConfig parseAntiSpamConfig(Form form) {
        String json = form.getAntiSpamJson();
        if (json == null || json.isBlank()) {
            return AntiSpamConfig.DEFAULT;
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            int max = node.path("max").asInt(DEFAULT_RATE_MAX);
            int windowSeconds = node.path("windowSeconds").asInt(DEFAULT_RATE_WINDOW_SEC);
            if (max <= 0 || windowSeconds <= 0) {
                return AntiSpamConfig.DEFAULT;
            }
            return new AntiSpamConfig(max, windowSeconds);
        } catch (Exception e) {
            return AntiSpamConfig.DEFAULT;
        }
    }

    private List<String> parseDedupKeys(Form form) {
        if (form.getDedupKeysJson() == null || form.getDedupKeysJson().isBlank()) {
            return DEFAULT_DEDUP_KEYS;
        }
        try {
            List<String> keys = objectMapper.readValue(form.getDedupKeysJson(), List.class);
            return keys.isEmpty() ? DEFAULT_DEDUP_KEYS : keys;
        } catch (Exception e) {
            return DEFAULT_DEDUP_KEYS;
        }
    }

    private DedupService.Policy parsePolicy(Form form) {
        if (form.getDedupPolicy() == null || form.getDedupPolicy().isBlank()) {
            return DedupService.Policy.REJECT;
        }
        try {
            return DedupService.Policy.valueOf(form.getDedupPolicy().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return DedupService.Policy.REJECT;
        }
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new IllegalStateException("JSON 序列化失败", e);
        }
    }

    private static String csv(String v) {
        if (v == null) return "";
        if (v.contains(",") || v.contains("\"") || v.contains("\n")) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }
}
