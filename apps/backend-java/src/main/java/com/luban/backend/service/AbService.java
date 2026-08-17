package com.luban.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luban.backend.dto.AbAssignResponse;
import com.luban.backend.dto.AbExperimentCreateRequest;
import com.luban.backend.dto.AbExperimentResponse;
import com.luban.backend.dto.AbVariantResponse;
import com.luban.backend.entity.AbAssignment;
import com.luban.backend.entity.AbExperiment;
import com.luban.backend.entity.AbVariant;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.AbAssignmentMapper;
import com.luban.backend.mapper.AbExperimentMapper;
import com.luban.backend.mapper.AbVariantMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * AB 实验领域服务（design D2：最小可测分桶）。
 *
 * <p>分桶一致性：uk(experiment_id, visitor_id) + 先查后插——同 visitor 命中既有 assignment 直接返回；
 * 并发首插竞态由唯一键兜底（撞键重查收敛，复用 LeadService uk_form_dedup 处理模式）。
 * 权重分桶：SHA-256(experimentId:visitorId) 取非负 long，对总权重取模落累积权重区间（确定性顺序遍历）。
 *
 * <p>assign 不加 @Transactional：单条 insert 无多语句一致性诉求，且避免撞键异常在事务内
 * 触发 rollback-only 后续重查失效（先查后插语义天然由唯一键保证收敛）。
 */
@Service
public class AbService {

    private static final int DEFAULT_WEIGHT = 50;

    private final AbExperimentMapper experimentMapper;
    private final AbVariantMapper variantMapper;
    private final AbAssignmentMapper assignmentMapper;
    private final SiteOwnershipGuard ownershipGuard;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AbService(AbExperimentMapper experimentMapper, AbVariantMapper variantMapper,
                     AbAssignmentMapper assignmentMapper, SiteOwnershipGuard ownershipGuard) {
        this.experimentMapper = experimentMapper;
        this.variantMapper = variantMapper;
        this.assignmentMapper = assignmentMapper;
        this.ownershipGuard = ownershipGuard;
    }

    /** 创建实验（含 variants）。创建即 running（status 请求字段接受但以 running 为准，见 DTO 注释）。 */
    @Transactional(rollbackFor = Exception.class)
    public AbExperimentResponse create(AbExperimentCreateRequest req) {
        ownershipGuard.assertCanWrite(req.siteId());
        Instant now = Instant.now();
        AbExperiment exp = new AbExperiment();
        exp.setId(UUID.randomUUID().toString());
        exp.setSiteId(req.siteId());
        exp.setPageId(req.pageId());
        exp.setName(req.name());
        exp.setStatus(AbExperiment.STATUS_RUNNING);
        exp.setStartedAt(now);
        exp.setCreatedAt(now);
        exp.setUpdatedAt(now);
        experimentMapper.insert(exp);

        List<AbVariant> variants = new ArrayList<>();
        List<AbExperimentCreateRequest.VariantPayload> payloads = req.variants();
        for (int i = 0; i < payloads.size(); i++) {
            AbExperimentCreateRequest.VariantPayload p = payloads.get(i);
            AbVariant v = new AbVariant();
            v.setId(UUID.randomUUID().toString());
            v.setExperimentId(exp.getId());
            v.setVariantKey(resolveVariantKey(p, i));
            v.setWeight(p.weight() != null ? p.weight() : DEFAULT_WEIGHT);
            v.setSchemaJson(toJsonString(p.schema()));
            v.setCreatedAt(now);
            variantMapper.insert(v);
            variants.add(v);
        }
        return toResponse(exp, variants);
    }

    /** 管理端列表（站点维度，新在前，含 variants）。 */
    public List<AbExperimentResponse> list(String siteId) {
        ownershipGuard.assertVisible(siteId);
        return experimentMapper.listBySiteId(siteId).stream()
                .map(e -> toResponse(e, variantMapper.listByExperimentId(e.getId())))
                .toList();
    }

    /** 结束实验（幂等：已 ended 返回当前态，不覆盖 ended_at）。 */
    @Transactional(rollbackFor = Exception.class)
    public AbExperimentResponse end(String experimentId) {
        AbExperiment exp = experimentMapper.getById(experimentId);
        if (exp == null) {
            throw experimentNotFound();
        }
        if (!AbExperiment.STATUS_ENDED.equals(exp.getStatus())) {
            Instant now = Instant.now();
            experimentMapper.end(exp.getId(), now, now);
            exp.setStatus(AbExperiment.STATUS_ENDED);
            exp.setEndedAt(now);
        }
        return toResponse(exp, variantMapper.listByExperimentId(exp.getId()));
    }

    /**
     * 公开分流：experimentId 直接定位；缺省按 pageId 解析（优先 running，否则最新 ended → 返回
     * variantId:null 的结束态；e2e AB2/AB3 走 pageId）。
     *
     * @throws BusinessException AB_EXPERIMENT_NOT_FOUND（实验不存在）
     */
    public AbAssignResponse assign(String experimentId, String pageId, String visitorId) {
        AbExperiment exp;
        if (experimentId != null && !experimentId.isBlank()) {
            exp = experimentMapper.getById(experimentId);
        } else {
            exp = experimentMapper.resolveByPageId(pageId);
        }
        if (exp == null) {
            throw experimentNotFound();
        }
        if (AbExperiment.STATUS_ENDED.equals(exp.getStatus())) {
            return AbAssignResponse.ended(exp.getId());
        }

        // 1. 一致性：既有分桶直接返回（稳定）
        AbAssignment existing = assignmentMapper.getByExperimentAndVisitor(exp.getId(), visitorId);
        if (existing != null) {
            return toAssignResponse(exp, existing.getVariantId());
        }

        // 2. 权重区间一致性哈希分桶
        List<AbVariant> variants = variantMapper.listByExperimentId(exp.getId());
        if (variants.isEmpty()) {
            // 防御：无变体的 running 实验无法分桶（创建契约 @NotEmpty 已拦），返回 null 变体而非 500
            return new AbAssignResponse(exp.getId(), null, null, exp.getStatus());
        }
        long totalWeight = variants.stream().mapToLong(AbVariant::getWeight).sum();
        // 防御：权重异常（≤0，创建契约已 @Positive 拦截正常不可达）时固定末位，避免 floorMod 除 0
        AbVariant chosen = totalWeight > 0
                ? pickVariant(variants, bucket(exp.getId(), visitorId, totalWeight))
                : variants.get(variants.size() - 1);

        AbAssignment assignment = new AbAssignment();
        assignment.setId(UUID.randomUUID().toString());
        assignment.setExperimentId(exp.getId());
        assignment.setVisitorId(visitorId);
        assignment.setVariantId(chosen.getId());
        assignment.setAssignedAt(Instant.now());
        try {
            assignmentMapper.insert(assignment);
        } catch (DataIntegrityViolationException e) {
            // 3. 并发竞态：check-then-insert 之间另一请求已分桶，撞 uk_aba_exp_visitor → 重查既有收敛
            if (!isUniqueViolation(e)) throw e;
            AbAssignment concurrent = assignmentMapper.getByExperimentAndVisitor(exp.getId(), visitorId);
            if (concurrent == null) throw e; // 理论不可达（唯一键冲突意味着必有既有行），防御性冒泡
            return toAssignResponse(exp, concurrent.getVariantId());
        }
        return toAssignResponse(exp, chosen.getId());
    }

    /** bucket = 非负哈希(experimentId:visitorId) 对总权重取模，落 [0, totalWeight)。 */
    static long bucket(String experimentId, String visitorId, long totalWeight) {
        return Math.floorMod(positiveHash(experimentId, visitorId), totalWeight);
    }

    /** SHA-256 前 8 字节 → 非负 long（跨 JVM/重启稳定，分散性优于 String.hashCode）。 */
    static long positiveHash(String experimentId, String visitorId) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest((experimentId + ":" + visitorId).getBytes(StandardCharsets.UTF_8));
            long v = 0L;
            for (int i = 0; i < 8; i++) {
                v = (v << 8) | (digest[i] & 0xFFL);
            }
            return v & Long.MAX_VALUE;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }

    /** 权重区间遍历：按列表顺序累积，bucket 落 [cum, cum+weight) 即命中；越界兜底末位（整除边界）。 */
    static AbVariant pickVariant(List<AbVariant> variants, long bucketValue) {
        long cumulative = 0L;
        for (AbVariant v : variants) {
            cumulative += v.getWeight();
            if (bucketValue < cumulative) {
                return v;
            }
        }
        return variants.get(variants.size() - 1);
    }

    private static String resolveVariantKey(AbExperimentCreateRequest.VariantPayload p, int index) {
        if (p.variantKey() != null && !p.variantKey().isBlank()) return p.variantKey().trim();
        if (p.label() != null && !p.label().isBlank()) return p.label().trim();
        return "variant-" + (index + 1);
    }

    /** 与 LeadService.isUniqueViolation 同口径：MySQL "Duplicate entry" / H2 "Unique index or primary key violation"。 */
    private static boolean isUniqueViolation(DataIntegrityViolationException e) {
        if (e == null || e.getMessage() == null) return false;
        String m = e.getMessage();
        return m.contains("Duplicate") || m.contains("Unique index") || m.contains("primary key violation");
    }

    private static BusinessException experimentNotFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "AB_EXPERIMENT_NOT_FOUND", "实验不存在");
    }

    private AbAssignResponse toAssignResponse(AbExperiment exp, String variantId) {
        String variantKey = null;
        if (variantId != null) {
            AbVariant v = variantMapper.getById(variantId);
            variantKey = v != null ? v.getVariantKey() : null;
        }
        return new AbAssignResponse(exp.getId(), variantId, variantKey, exp.getStatus());
    }

    private AbExperimentResponse toResponse(AbExperiment exp, List<AbVariant> variants) {
        List<AbVariantResponse> vr = variants == null ? List.of() : variants.stream()
                .map(v -> new AbVariantResponse(v.getId(), v.getVariantKey(), v.getWeight(), parseSchema(v.getSchemaJson())))
                .toList();
        return new AbExperimentResponse(exp.getId(), exp.getSiteId(), exp.getPageId(), exp.getName(),
                exp.getStatus(), exp.getStartedAt(), exp.getEndedAt(), exp.getCreatedAt(), exp.getUpdatedAt(), vr);
    }

    private JsonNode parseSchema(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return objectMapper.readTree(raw);
        } catch (Exception e) {
            return null; // 坏数据降级为 null，不阻断响应
        }
    }

    private String toJsonString(JsonNode node) {
        if (node == null || node.isNull()) return null;
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            throw BusinessException.invalidArgument("variants.schema 序列化失败");
        }
    }
}
