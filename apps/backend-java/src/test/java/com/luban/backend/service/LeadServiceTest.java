package com.luban.backend.service;

import com.luban.backend.dto.LeadSubmitRequest;
import com.luban.backend.dto.LeadSubmitResult;
import com.luban.backend.entity.Form;
import com.luban.backend.entity.Lead;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.FormMapper;
import com.luban.backend.mapper.LeadMapper;
import com.luban.backend.mapper.SiteMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * LeadService 编排单测：mock mapper/antiSpam/notify，真实 Dedup/Crypto/StatusMachine。
 * 覆盖提交成功、去重(reject/mark)、防刷、表单不存在、contact 加密。
 */
@ExtendWith(MockitoExtension.class)
class LeadServiceTest {

    @Mock private FormMapper formMapper;
    @Mock private LeadMapper leadMapper;
    @Mock private AntiSpamService antiSpamService;
    @Mock private LeadNotifyService notifyService;
    // signup-billing-onboarding 新依赖：默认 mock（siteMapper.getById 返回 null → 平台站点语义，
    // quota/ownership 不介入），既有用例行为不变
    @Mock private SiteMapper siteMapper;
    @Mock private SiteOwnershipGuard ownershipGuard;
    @Mock private QuotaService quotaService;
    // feature-gate 新依赖：默认 fail-open（isEnabled=true），既有用例行为不变
    @Mock private FeatureGateService featureGateService;

    private LeadService service;

    private Form sampleForm() {
        Form f = new Form();
        f.setId("form-1");
        f.setSiteId("site-1");
        f.setPageId("page-1");
        f.setName("报名表单");
        f.setDedupWindow(86400);
        f.setDedupPolicy("reject");
        f.setStatus("active");
        return f;
    }

    @BeforeEach
    void setup() {
        // lead_capture gate fail-open：submitFormNotFoundThrows 用例不触达 gate 检查，lenient 避免严格桩告警
        lenient().when(featureGateService.isEnabled(anyString(), anyString())).thenReturn(true);
        service = new LeadService(formMapper, leadMapper, siteMapper, ownershipGuard, quotaService,
                featureGateService, new DedupService(), antiSpamService, new LeadCryptoService(""), new LeadStatusMachine(), notifyService);
    }

    private LeadSubmitRequest req(String phone) {
        return new LeadSubmitRequest("form-1", Map.of("phone", phone, "name", "张三"),
                "page-1", null, null, "1.2.3.4", "visitor-1", null);
    }

    @Test
    void submitSuccessInsertsNewLeadAndNotifies() {
        when(formMapper.getById("form-1")).thenReturn(sampleForm());
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(eq("form-1"), anyString(), any())).thenReturn(0);

        LeadSubmitResult result = service.submit(req("13800000001"));

        assertThat(result.status()).isEqualTo("new");
        assertThat(result.dedup()).isFalse();
        assertThat(result.leadId()).isNotBlank();
        verify(leadMapper).insert(any());
        verify(notifyService).notifyNewLead(any(), any());
    }

    @Test
    void submitEncryptsContactNotPlain() {
        when(formMapper.getById("form-1")).thenReturn(sampleForm());
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(anyString(), anyString(), any())).thenReturn(0);

        org.mockito.ArgumentCaptor<com.luban.backend.entity.Lead> captor =
                org.mockito.ArgumentCaptor.forClass(com.luban.backend.entity.Lead.class);

        service.submit(req("13800000001"));
        verify(leadMapper).insert(captor.capture());
        String stored = captor.getValue().getContactJson();
        assertThat(stored).isNotEqualTo("{\"phone\":\"13800000001\"}"); // 非明文
        assertThat(stored).doesNotContain("13800000001"); // 明文不出现在加密串
    }

    @Test
    void submitDuplicateRejectThrows() {
        when(formMapper.getById("form-1")).thenReturn(sampleForm());
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(anyString(), anyString(), any())).thenReturn(1); // 已存在

        assertThatThrownBy(() -> service.submit(req("13800000001")))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo("LEAD_DUPLICATE");
        verify(leadMapper, never()).insert(any());
    }

    @Test
    void submitDuplicateMarkInsertsInvalid() {
        Form f = sampleForm();
        f.setDedupPolicy("mark");
        when(formMapper.getById("form-1")).thenReturn(f);
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(anyString(), anyString(), any())).thenReturn(1);

        LeadSubmitResult result = service.submit(req("13800000001"));

        assertThat(result.status()).isEqualTo("invalid");
        assertThat(result.dedup()).isTrue();
        verify(leadMapper).insert(any());
    }

    @Test
    void submitDuplicateMergeUpdatesExistingContact() {
        Form f = sampleForm();
        f.setDedupPolicy("merge");
        when(formMapper.getById("form-1")).thenReturn(f);
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(anyString(), anyString(), any())).thenReturn(1);

        LeadCryptoService crypto = new LeadCryptoService("");
        String existingEncrypted = crypto.encrypt("{\"phone\":\"13800000001\",\"name\":\"旧名\",\"email\":\"old@x.com\"}");
        Lead existing = new Lead();
        existing.setId("lead-existing");
        existing.setFormId("form-1");
        existing.setSiteId("site-1");
        existing.setContactJson(existingEncrypted);
        existing.setStatus("new");
        existing.setUpdatedAt(java.time.Instant.now());
        when(leadMapper.findLatestByFormHash(eq("form-1"), anyString())).thenReturn(existing);
        when(leadMapper.updateContactByDedup(eq("form-1"), anyString(), anyString(), any(), any())).thenReturn(1);

        // 新提交：同 phone（命中去重）+ name 覆盖旧值；email 旧值应保留
        LeadSubmitResult result = service.submit(new LeadSubmitRequest("form-1",
                Map.of("phone", "13800000001", "name", "新名"), "page-1", null, null, "1.2.3.4", "visitor-1", null));

        assertThat(result.dedup()).isTrue();
        assertThat(result.leadId()).isEqualTo("lead-existing");
        assertThat(result.status()).isEqualTo("new");
        verify(leadMapper, never()).insert(any());
        verify(notifyService, never()).notifyNewLead(any(), any()); // MERGE 不重复通知

        org.mockito.ArgumentCaptor<String> contactCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(leadMapper).updateContactByDedup(eq("form-1"), anyString(), contactCaptor.capture(), any(), any());
        String mergedPlain = crypto.decrypt(contactCaptor.getValue());
        assertThat(mergedPlain).contains("\"name\":\"新名\"");        // 新值覆盖同名
        assertThat(mergedPlain).contains("\"email\":\"old@x.com\""); // 旧独有字段保留
    }

    @Test
    void submitDuplicateMergeOptimisticLockConflictReturnsCurrent() {
        Form f = sampleForm();
        f.setDedupPolicy("merge");
        when(formMapper.getById("form-1")).thenReturn(f);
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(anyString(), anyString(), any())).thenReturn(1);

        Lead existing = new Lead();
        existing.setId("lead-existing");
        existing.setFormId("form-1");
        existing.setContactJson(new LeadCryptoService("").encrypt("{\"phone\":\"13800000001\"}"));
        existing.setStatus("new");
        existing.setUpdatedAt(java.time.Instant.now());
        when(leadMapper.findLatestByFormHash(eq("form-1"), anyString())).thenReturn(existing);
        when(leadMapper.updateContactByDedup(anyString(), anyString(), anyString(), any(), any())).thenReturn(0); // 乐观锁冲突

        LeadSubmitResult result = service.submit(req("13800000001"));

        assertThat(result.dedup()).isTrue();
        assertThat(result.leadId()).isEqualTo("lead-existing"); // 返回当前态，不抛 500
        assertThat(result.status()).isEqualTo("new");
        verify(leadMapper, never()).insert(any());
        verify(notifyService, never()).notifyNewLead(any(), any()); // MERGE 不重复通知
    }

    @Test
    void submitSpamBlockedThrows() {
        when(formMapper.getById("form-1")).thenReturn(sampleForm());
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(true);

        assertThatThrownBy(() -> service.submit(req("13800000001")))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo("LEAD_SPAM_BLOCKED");
        verify(leadMapper, never()).insert(any());
    }

    @Test
    void submitFormNotFoundThrows() {
        when(formMapper.getById("form-1")).thenReturn(null);

        assertThatThrownBy(() -> service.submit(req("13800000001")))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo("FORM_NOT_FOUND");
    }

    // === lead_capture gate（wire-e2e-feature-gaps 1.3：关闭 → LEAD_DISABLED） ===

    @Test
    void submitLeadCaptureGateDisabledThrows() {
        when(formMapper.getById("form-1")).thenReturn(sampleForm());
        when(featureGateService.isEnabled("site-1", FeatureGateService.KEY_LEAD_CAPTURE)).thenReturn(false);

        assertThatThrownBy(() -> service.submit(req("13800000001")))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo("LEAD_DISABLED");
        // 拦截在防刷/去重/入库之前，不产生任何写
        verify(leadMapper, never()).insert(any());
        verify(quotaService, never()).checkAndIncrement(anyString(), anyString());
        verify(notifyService, never()).notifyNewLead(any(), any());
    }

    // === uk_form_dedup 唯一键冲突（并发竞态）收敛路径（close-review-gaps 3.3） ===

    /** H2/MySQL 唯一键冲突消息（对齐 SiteService.isUniqueViolation 口径）。 */
    private static DataIntegrityViolationException ukViolation() {
        return new DataIntegrityViolationException(
                "Unique index or primary key violation: uk_form_dedup ON leads");
    }

    @Test
    void submitUniqueKeyConflict_rejectPolicyReturns409Not500() {
        when(formMapper.getById("form-1")).thenReturn(sampleForm());
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        // 窗口内查不到（另一并发请求刚插入未提交 / 窗口过期）→ ACCEPT → insert 撞唯一键
        when(leadMapper.countByFormHashInWindow(eq("form-1"), anyString(), any())).thenReturn(0);
        when(leadMapper.insert(any())).thenThrow(ukViolation());

        assertThatThrownBy(() -> service.submit(req("13800000001")))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo("LEAD_DUPLICATE"); // 409，不再 500
    }

    @Test
    void submitUniqueKeyConflict_mergePolicyMergesExisting() {
        Form f = sampleForm();
        f.setDedupPolicy("merge");
        when(formMapper.getById("form-1")).thenReturn(f);
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(eq("form-1"), anyString(), any())).thenReturn(0);
        // 竞态时序：MERGE 预检 findLatest 为 null（对方未提交）→ insert 撞唯一键 → 冲突后再查命中
        Lead existing = new Lead();
        existing.setId("lead-existing");
        existing.setFormId("form-1");
        existing.setSiteId("site-1");
        existing.setContactJson(new LeadCryptoService("").encrypt("{\"phone\":\"13800000001\"}"));
        existing.setStatus("new");
        existing.setUpdatedAt(java.time.Instant.now());
        when(leadMapper.findLatestByFormHash(eq("form-1"), anyString())).thenReturn(null, existing);
        when(leadMapper.insert(any())).thenThrow(ukViolation());
        when(leadMapper.updateContactByDedup(eq("form-1"), anyString(), anyString(), any(), any())).thenReturn(1);

        LeadSubmitResult result = service.submit(req("13800000001"));

        assertThat(result.leadId()).isEqualTo("lead-existing"); // 复用既有 lead
        assertThat(result.dedup()).isTrue();
        verify(leadMapper).updateContactByDedup(eq("form-1"), anyString(), anyString(), any(), any());
        verify(notifyService, never()).notifyNewLead(any(), any()); // 不重复通知
    }

    @Test
    void submitUniqueKeyConflict_markPolicyReturnsExistingState() {
        Form f = sampleForm();
        f.setDedupPolicy("mark");
        when(formMapper.getById("form-1")).thenReturn(f);
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(eq("form-1"), anyString(), any())).thenReturn(0);
        Lead existing = new Lead();
        existing.setId("lead-existing");
        existing.setFormId("form-1");
        existing.setSiteId("site-1");
        existing.setStatus("invalid");
        existing.setUpdatedAt(java.time.Instant.now());
        when(leadMapper.findLatestByFormHash(eq("form-1"), anyString())).thenReturn(existing);
        when(leadMapper.insert(any())).thenThrow(ukViolation());

        LeadSubmitResult result = service.submit(req("13800000001"));

        assertThat(result.leadId()).isEqualTo("lead-existing");
        assertThat(result.status()).isEqualTo("invalid");
        assertThat(result.dedup()).isTrue();
        verify(notifyService, never()).notifyNewLead(any(), any());
    }

    @Test
    void submitNonUniqueIntegrityViolation_propagates() {
        when(formMapper.getById("form-1")).thenReturn(sampleForm());
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(eq("form-1"), anyString(), any())).thenReturn(0);
        // 非唯一键的完整性冲突（如 FK）不吞掉，原样传播
        when(leadMapper.insert(any())).thenThrow(new DataIntegrityViolationException("Referential integrity constraint violation"));

        assertThatThrownBy(() -> service.submit(req("13800000001")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    // === 唯一键冲突收敛路径的配额回退（收敛复用既有 lead，不残留 leads 计数） ===

    @Test
    void submitUniqueKeyConflict_convergePathRollsBackQuotaIncrement() {
        Form f = sampleForm();
        f.setDedupPolicy("mark");
        when(formMapper.getById("form-1")).thenReturn(f);
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(eq("form-1"), anyString(), any())).thenReturn(0);
        // 有主站点：配额按 owner 计（触发 checkAndIncrement）
        com.luban.backend.entity.Site site = new com.luban.backend.entity.Site();
        site.setId("site-1");
        site.setOwnerUserId("own-1");
        when(siteMapper.getById("site-1")).thenReturn(site);
        Lead existing = new Lead();
        existing.setId("lead-existing");
        existing.setFormId("form-1");
        existing.setSiteId("site-1");
        existing.setStatus("invalid");
        existing.setUpdatedAt(java.time.Instant.now());
        when(leadMapper.findLatestByFormHash(eq("form-1"), anyString())).thenReturn(existing);
        when(leadMapper.insert(any())).thenThrow(ukViolation());

        LeadSubmitResult result = service.submit(req("13800000001"));

        assertThat(result.leadId()).isEqualTo("lead-existing");
        verify(quotaService).checkAndIncrement("own-1", QuotaService.METRIC_LEADS);
        // 收敛路径未产生新 lead：回退已累加的 leads 计数
        verify(quotaService).decrement("own-1", QuotaService.METRIC_LEADS);
    }

    // === resolveQuotaOwner 配额归属（site→owner；owner=NULL 平台站点不限） ===

    @Test
    void submitWithOwnedSiteChargesLeadsQuotaToSiteOwner() {
        when(formMapper.getById("form-1")).thenReturn(sampleForm());
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(eq("form-1"), anyString(), any())).thenReturn(0);
        com.luban.backend.entity.Site site = new com.luban.backend.entity.Site();
        site.setId("site-1");
        site.setOwnerUserId("own-1");
        when(siteMapper.getById("site-1")).thenReturn(site);

        service.submit(req("13800000001"));

        // site 带 owner → 配额按 owner 计（submitter 语境下即站点归属人）
        verify(quotaService).checkAndIncrement("own-1", QuotaService.METRIC_LEADS);
    }

    @Test
    void submitOnPlatformSiteWithoutOwnerSkipsQuota() {
        when(formMapper.getById("form-1")).thenReturn(sampleForm());
        when(antiSpamService.isRateLimited(anyString(), anyString(), anyInt(), anyInt())).thenReturn(false);
        when(leadMapper.countByFormHashInWindow(eq("form-1"), anyString(), any())).thenReturn(0);
        com.luban.backend.entity.Site site = new com.luban.backend.entity.Site();
        site.setId("site-1");
        site.setOwnerUserId(null); // 平台站点
        when(siteMapper.getById("site-1")).thenReturn(site);

        LeadSubmitResult result = service.submit(req("13800000001"));

        // owner=NULL → 不限，不查不累加任何人的配额
        assertThat(result.status()).isEqualTo("new");
        verify(quotaService, never()).checkAndIncrement(anyString(), anyString());
    }
}
