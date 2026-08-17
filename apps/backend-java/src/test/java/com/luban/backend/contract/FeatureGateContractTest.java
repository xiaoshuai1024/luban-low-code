package com.luban.backend.contract;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FeatureGate 域契约（wire-e2e-feature-gaps 1.1–1.3，对齐 e2e/flows/feature-gate-*.spec.ts）：
 *
 *   PUT  /feature-gates?siteId=&key=&enabled=   管理端配置 upsert（owner/admin；e2e 参数走 query string）
 *   GET  /feature-gates?siteId=                  管理端列表（登录态 + 归属校验）
 *   GET  /public/feature-gates?siteId=&key=      公开查询 → {enabled}（免鉴权，fail-open）
 *   POST /lead/forms/{formId}/submit             lead_capture 关闭 → 503 LEAD_DISABLED（fail-open 放行）
 *
 * 真实性：H2 真实跑 Flyway 迁移（含 V20260817130001 feature_gates 表 + ON DUPLICATE KEY upsert）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FeatureGateContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;

    private String uid() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private MockHttpServletRequestBuilder user(MockHttpServletRequestBuilder b, String userId, String role) {
        return b.contextPath("/backend").header("X-User-ID", userId).header("X-User-Role", role);
    }

    /** 种子用户（sites.owner FK 需要）并返回其 id。 */
    private String seedUser(String role) {
        String id = "u-" + uid();
        Instant now = Instant.now();
        jdbc.update("INSERT INTO users (id, username, name, role, status, password, created_at, updated_at) " +
                        "VALUES (?, ?, ?, ?, 'active', 'x', ?, ?)",
                id, "fg-" + id, "fg", role, now, now);
        return id;
    }

    /** 种子站点（owner 为空 = 平台站点语义，仅 admin 可写，避开 quota/subscription 依赖）。 */
    private String seedSite() {
        String id = "fg-site-" + uid();
        Instant now = Instant.now();
        jdbc.update("INSERT INTO sites (id, name, slug, base_url, status, created_at, updated_at) " +
                        "VALUES (?, 'fg-site', ?, '', 'active', ?, ?)",
                id, "slug-fg-" + id.substring(8), now, now);
        return id;
    }

    /** 种子带 owner 的站点（归属校验用例）。 */
    private String seedOwnedSite(String ownerUserId) {
        String id = "fg-own-" + uid();
        Instant now = Instant.now();
        jdbc.update("INSERT INTO sites (id, name, slug, base_url, owner_user_id, status, created_at, updated_at) " +
                        "VALUES (?, 'fg-owned', ?, '', ?, 'active', ?, ?)",
                id, "slug-fo-" + id.substring(6), ownerUserId, now, now);
        return id;
    }

    /** 种子 site/page/form（留资提交链路 fixture），返回 formId。 */
    private String seedForm(String siteId) {
        Instant now = Instant.now();
        String pageId = "fg-page-" + uid();
        String formId = "fg-form-" + uid();
        jdbc.update("INSERT INTO pages (id, site_id, name, path, status, schema_json, created_at, updated_at) " +
                "VALUES (?, ?, 'fg-landing', ?, 'published', '{}', ?, ?)", pageId, siteId, "/fg-" + uid(), now, now);
        jdbc.update("INSERT INTO forms (id, site_id, page_id, name, field_schema_json, submit_config_json, dedup_keys_json, dedup_window, dedup_policy, status, created_at, updated_at) " +
                        "VALUES (?, ?, ?, 'fg-signup', '[]', '{}', '[\"phone\"]', 86400, 'reject', 'active', ?, ?)",
                formId, siteId, pageId, now, now);
        return formId;
    }

    private void cleanupSite(String siteId) {
        jdbc.update("DELETE FROM feature_gates WHERE site_id = ?", siteId);
        jdbc.update("DELETE FROM leads WHERE site_id = ?", siteId);
        jdbc.update("DELETE FROM forms WHERE site_id = ?", siteId);
        jdbc.update("DELETE FROM pages WHERE site_id = ?", siteId);
        jdbc.update("DELETE FROM sites WHERE id = ?", siteId);
    }

    // === 管理端 PUT + 公开端点读回（FG1 主链路） ===

    @Test
    void putFalseThenPublicGetReadsFalseAndReEnableReadsTrue() throws Exception {
        String siteId = seedSite();
        try {
            // admin 配置关闭（平台站点 owner=NULL 仅 admin）
            mockMvc.perform(user(put("/backend/feature-gates")
                            .queryParam("siteId", siteId)
                            .queryParam("key", "lead_capture")
                            .queryParam("enabled", "false"), "admin-1", "admin"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.siteId").value(siteId))
                    .andExpect(jsonPath("$.gateKey").value("lead_capture"))
                    .andExpect(jsonPath("$.enabled").value(false));

            // 公开端点（无鉴权头）读到关闭状态
            mockMvc.perform(get("/backend/public/feature-gates").contextPath("/backend")
                            .queryParam("siteId", siteId).queryParam("key", "lead_capture"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.enabled").value(false));

            // 重新开启 → 读回 true（幂等 upsert，不重复建行）
            mockMvc.perform(user(put("/backend/feature-gates")
                            .queryParam("siteId", siteId)
                            .queryParam("key", "lead_capture")
                            .queryParam("enabled", "true"), "admin-1", "admin"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.enabled").value(true));
            mockMvc.perform(get("/backend/public/feature-gates").contextPath("/backend")
                            .queryParam("siteId", siteId).queryParam("key", "lead_capture"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.enabled").value(true));

            Integer rows = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM feature_gates WHERE site_id = ? AND gate_key = 'lead_capture'",
                    Integer.class, siteId);
            org.assertj.core.api.Assertions.assertThat(rows).isEqualTo(1); // upsert 不重复建行
        } finally {
            cleanupSite(siteId);
        }
    }

    // === fail-open（FG4 / visitor FG2） ===

    @Test
    void publicGetUnknownKeyFailsOpenWithEnabledTrue() throws Exception {
        String siteId = seedSite();
        try {
            mockMvc.perform(get("/backend/public/feature-gates").contextPath("/backend")
                            .queryParam("siteId", siteId).queryParam("key", "non_existent_key"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.enabled").value(true));
        } finally {
            cleanupSite(siteId);
        }
    }

    // === lead_capture 关闭 → 留资提交 LEAD_DISABLED（full-link FG2/FG3） ===

    @Test
    void leadCaptureDisabledBlocksSubmitAndReEnableRestores() throws Exception {
        String siteId = seedSite();
        String formId = seedForm(siteId);
        try {
            mockMvc.perform(user(put("/backend/feature-gates")
                            .queryParam("siteId", siteId)
                            .queryParam("key", "lead_capture")
                            .queryParam("enabled", "false"), "admin-1", "admin"))
                    .andExpect(status().isOk());

            // gate 关闭 → 提交被拦（503 LEAD_DISABLED，e2e 契约码）
            mockMvc.perform(post("/backend/lead/forms/{formId}/submit", formId).contextPath("/backend")
                            .header("X-Forwarded-For", "")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"formId\":\"" + formId + "\",\"contact\":{\"phone\":\"13700000001\",\"name\":\"gate测试\"}}"))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.code").value("LEAD_DISABLED"));
            Integer leads = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM leads WHERE form_id = ?", Integer.class, formId);
            org.assertj.core.api.Assertions.assertThat(leads).isZero(); // 拦截在入库前

            // 重新开启 → 恢复正常提交（2xx，status=new）
            mockMvc.perform(user(put("/backend/feature-gates")
                            .queryParam("siteId", siteId)
                            .queryParam("key", "lead_capture")
                            .queryParam("enabled", "true"), "admin-1", "admin"))
                    .andExpect(status().isOk());
            mockMvc.perform(post("/backend/lead/forms/{formId}/submit", formId).contextPath("/backend")
                            .header("X-Forwarded-For", "")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"formId\":\"" + formId + "\",\"contact\":{\"phone\":\"13700000002\",\"name\":\"恢复测试\"}}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("new"));
        } finally {
            cleanupSite(siteId);
        }
    }

    // === 管理端列表 + 鉴权 ===

    @Test
    void managementListRequiresLoginAndReturnsConfiguredGates() throws Exception {
        String owner = seedUser("user");
        String siteId = seedOwnedSite(owner);
        try {
            // 未登录 → 401（AuthFilter RequireUser）
            mockMvc.perform(get("/backend/feature-gates").contextPath("/backend")
                            .queryParam("siteId", siteId))
                    .andExpect(status().isUnauthorized());
            mockMvc.perform(put("/backend/feature-gates").contextPath("/backend")
                            .queryParam("siteId", siteId).queryParam("key", "lead_capture").queryParam("enabled", "false"))
                    .andExpect(status().isUnauthorized());

            // owner 配置两条 gate 后列表可见
            mockMvc.perform(user(put("/backend/feature-gates")
                            .queryParam("siteId", siteId).queryParam("key", "lead_capture")
                            .queryParam("enabled", "false"), owner, "user"))
                    .andExpect(status().isOk());
            mockMvc.perform(user(put("/backend/feature-gates")
                            .queryParam("siteId", siteId).queryParam("key", "realtime_collab")
                            .queryParam("enabled", "true"), owner, "user"))
                    .andExpect(status().isOk());

            mockMvc.perform(user(get("/backend/feature-gates").queryParam("siteId", siteId), owner, "user"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].gateKey").value("lead_capture"))
                    .andExpect(jsonPath("$[0].enabled").value(false))
                    .andExpect(jsonPath("$[1].gateKey").value("realtime_collab"))
                    .andExpect(jsonPath("$[1].enabled").value(true));
        } finally {
            cleanupSite(siteId);
            jdbc.update("DELETE FROM users WHERE id = ?", owner);
        }
    }

    // === 归属校验（IDOR：非 owner 普通用户不可配置他人站点） ===

    @Test
    void putByNonOwnerOtherUserIsForbidden() throws Exception {
        String owner = seedUser("user");
        String attacker = seedUser("user");
        String siteId = seedOwnedSite(owner);
        try {
            mockMvc.perform(user(put("/backend/feature-gates")
                            .queryParam("siteId", siteId).queryParam("key", "lead_capture")
                            .queryParam("enabled", "false"), attacker, "user"))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
            // 越权写未落库
            Integer rows = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM feature_gates WHERE site_id = ?", Integer.class, siteId);
            org.assertj.core.api.Assertions.assertThat(rows).isZero();
        } finally {
            cleanupSite(siteId);
            jdbc.update("DELETE FROM users WHERE id IN (?, ?)", owner, attacker);
        }
    }

    // === 参数校验 ===

    @Test
    void putRejectsInvalidGateKeyAndUnknownSite() throws Exception {
        String siteId = seedSite();
        try {
            // 非法 key（含中文/空格）→ 400 INVALID_ARGUMENT（归属校验通过后才到 key 校验）
            mockMvc.perform(user(put("/backend/feature-gates")
                            .queryParam("siteId", siteId).queryParam("key", "非法 key!")
                            .queryParam("enabled", "true"), "admin-1", "admin"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_ARGUMENT"));
        } finally {
            cleanupSite(siteId);
        }

        // 不存在的站点 → 404 SITE_NOT_FOUND（assertCanWrite）
        mockMvc.perform(user(put("/backend/feature-gates")
                        .queryParam("siteId", "no-such-site").queryParam("key", "lead_capture")
                        .queryParam("enabled", "true"), "admin-1", "admin"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SITE_NOT_FOUND"));
    }
}
