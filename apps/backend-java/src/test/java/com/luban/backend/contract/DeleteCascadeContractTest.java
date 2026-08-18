package com.luban.backend.contract;

import com.luban.backend.dto.LeadSubmitRequest;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.service.DedupService;
import com.luban.backend.service.LeadService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.luban.backend.service.AntiSpamService;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 删除链路 + 去重竞态契约测试（H2 集成，close-review-gaps 第 3 组）：
 * - 删带表单（无 leads）页面 → 204 且表单级联删除
 * - 删带线索的页面/表单 → 409 PAGE_HAS_LEADS / FORM_HAS_LEADS（不再 500）
 * - 删站点级联清理全部子表（事务原子性的成功路径验证）
 * - uk_form_dedup 唯一键冲突路径：check-then-insert 竞态/窗口过期重复 → 409 LEAD_DUPLICATE（不再 500）
 * 每个用例独立随机 ID 种子，无需跨用例清理。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DeleteCascadeContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private LeadService leadService;
    @Autowired private DedupService dedupService;

    /** AntiSpamService 经 Redis 频控；test profile 无 Redis，mock 放行。 */
    @MockBean private AntiSpamService antiSpamService;

    private final String uid = UUID.randomUUID().toString().substring(0, 8);
    private String siteId;
    private String pageId;
    private String formId;

    /** 包装：contextPath + admin header（与 V2FeaturesContractTest 一致）。 */
    private MockHttpServletRequestBuilder req(MockHttpServletRequestBuilder b) {
        return b.contextPath("/backend").header("X-User-ID", "admin-001").header("X-User-Role", "admin");
    }

    @BeforeEach
    void seed() {
        siteId = "site-" + uid;
        pageId = "page-" + uid;
        formId = "form-" + uid;
        Instant now = Instant.now();
        jdbc.update(
            "INSERT INTO sites (id, name, slug, base_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            siteId, "删除链路测试站", "del-" + uid, "http://del.test", "active", now, now);
        jdbc.update(
            "INSERT INTO pages (id, site_id, name, path, status, schema_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            pageId, siteId, "落地页", "/del-" + uid, "published", "{}", now, now);
        jdbc.update(
            "INSERT INTO forms (id, site_id, page_id, name, field_schema_json, submit_config_json, "
                + "dedup_keys_json, dedup_window, dedup_policy, status, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            formId, siteId, pageId, "报名表", "[]", "{}", "[\"phone\"]", 86400, "reject", "active", now, now);
    }

    private void insertLead(String hash, Instant createdAt) {
        jdbc.update(
            "INSERT INTO leads (id, site_id, form_id, page_id, contact_json, dedup_hash, status, created_at, updated_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            "lead-" + UUID.randomUUID().toString().substring(0, 31), siteId, formId, pageId,
            "encrypted-contact", hash, "new",
            createdAt, createdAt);
    }

    private int count(String table, String where, String arg) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE " + where + " = ?", Integer.class, arg);
        return n != null ? n : 0;
    }

    // === 3.1 PageService.delete：级联 + 409 ===

    @Test
    void deletePage_cascadesFormsAndReturns204() throws Exception {
        mockMvc.perform(req(delete("/backend/sites/" + siteId + "/pages/" + pageId)))
            .andExpect(status().isNoContent());

        assertThat(count("forms", "page_id", pageId)).isZero(); // 表单已级联删除
        assertThat(count("pages", "id", pageId)).isZero();
    }

    @Test
    void deletePage_withLeadsReturns409AndKeepsPage() throws Exception {
        String hash = dedupService.computeHash(formId, Map.of("phone", "13800000000"), List.of("phone"));
        insertLead(hash, Instant.now());

        mockMvc.perform(req(delete("/backend/sites/" + siteId + "/pages/" + pageId)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("PAGE_HAS_LEADS"));

        // 409 后页面与表单均保留（事务回滚，无半删状态）
        mockMvc.perform(req(get("/backend/sites/" + siteId + "/pages/" + pageId)))
            .andExpect(status().isOk());
        assertThat(count("forms", "id", formId)).isEqualTo(1);
    }

    // === 3.4 DELETE /forms/{id}：204 与 409 分支 ===

    @Test
    void deleteForm_withoutLeadsReturns204() throws Exception {
        mockMvc.perform(req(delete("/backend/forms/" + formId).queryParam("siteId", siteId)))
            .andExpect(status().isNoContent());

        mockMvc.perform(req(get("/backend/forms/" + formId).queryParam("siteId", siteId)))
            .andExpect(status().isNotFound());
    }

    @Test
    void deleteForm_withLeadsReturns409AndKeepsForm() throws Exception {
        String hash = dedupService.computeHash(formId, Map.of("phone", "13800000001"), List.of("phone"));
        insertLead(hash, Instant.now());

        mockMvc.perform(req(delete("/backend/forms/" + formId).queryParam("siteId", siteId)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("FORM_HAS_LEADS"));

        mockMvc.perform(req(get("/backend/forms/" + formId).queryParam("siteId", siteId)))
            .andExpect(status().isOk());
    }

    // === 3.2 SiteService 级联删除（@Transactional 原子化的成功路径） ===

    @Test
    void deleteSite_cascadesAllChildren() throws Exception {
        String hash = dedupService.computeHash(formId, Map.of("phone", "13800000002"), List.of("phone"));
        insertLead(hash, Instant.now());

        mockMvc.perform(req(delete("/backend/sites/" + siteId)))
            .andExpect(status().isNoContent());

        assertThat(count("leads", "site_id", siteId)).isZero();
        assertThat(count("forms", "site_id", siteId)).isZero();
        assertThat(count("pages", "site_id", siteId)).isZero();
        assertThat(count("sites", "id", siteId)).isZero();
        mockMvc.perform(req(get("/backend/sites/" + siteId)))
            .andExpect(status().isNotFound());
    }

    // === 3.3 LeadService.submit：uk_form_dedup 唯一键冲突不再 500 ===

    @Test
    void submit_hittingUniqueKeyReturns409Not500() {
        // 模拟竞态：同指纹 lead 已存在（窗口外，countByFormHashInWindow=0），
        // check-then-insert 判定 ACCEPT → insert 撞 uk_form_dedup → 须收敛为 409 LEAD_DUPLICATE
        String phone = "138" + uid + "0000";
        String hash = dedupService.computeHash(formId, Map.of("phone", phone), List.of("phone"));
        insertLead(hash, Instant.now().minusSeconds(2 * 86400L)); // dedup_window=86400 之外

        assertThatThrownBy(() -> leadService.submit(new LeadSubmitRequest(
                formId, Map.of("phone", phone), pageId, null, null, "10.9.9.9", "v-race", null)))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode())
                .isEqualTo("LEAD_DUPLICATE");
    }
}
