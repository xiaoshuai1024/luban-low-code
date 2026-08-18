package com.luban.backend.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * quota 拦截集成测试（T-be-5，Failsafe IT）：真实 H2 + 真实 usage_counters 原子累加。
 *
 * 场景（对应 e2e S6）：e2e-tiny（hidden，quota_leads=1/quota_pages=1）下单 →
 * 第 2 个页面 429 QUOTA_EXCEEDED(metric=pages)；第 2 条 lead 429(metric=leads)。
 *
 * 该 IT 同时实测 H2 MODE=MySQL 对 INSERT ... ON DUPLICATE KEY UPDATE 的兼容性
 * （plan §9.3：不等价则退两步法）——累计两次 leads/pages 均落 usage_counters。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class QuotaEnforcementIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;

    /** test profile 无 Redis（懒连接不校验，首命令即挂）——与 DeleteCascadeContractTest 同款处理。 */
    @MockBean private com.luban.backend.service.AntiSpamService antiSpamService;

    private String userId;
    private String siteId;
    private String formId;
    private String pageId;

    @BeforeEach
    void seed() {
        String uid = UUID.randomUUID().toString().substring(0, 8);
        userId = "uq-" + uid;
        siteId = "qsite-" + uid;
        pageId = "qpage-" + uid;
        formId = "qform-" + uid;
        Instant now = Instant.now();

        jdbc.update("INSERT INTO users (id, username, name, role, status, password, created_at, updated_at) " +
                "VALUES (?, ?, ?, 'user', 'active', 'x', ?, ?)", userId, "quota-" + uid, "quota", now, now);
        // e2e-tiny：与 E2EBillingPlanBootstrap 同参（hidden，1/1）；默认测试上下文未启用 bootstrap，手动落 fixture
        jdbc.update("MERGE INTO plans (plan_code, name, status, price_monthly, quota_leads, quota_pages, quota_visits, gates, trial_days, sort_order) " +
                        "KEY(plan_code) VALUES ('e2e-tiny', 'E2E Tiny (fixture)', 'hidden', 0, 1, 1, 0, NULL, 0, 99)");
        jdbc.update("INSERT INTO sites (id, name, slug, base_url, owner_user_id, status, created_at, updated_at) " +
                "VALUES (?, ?, ?, '', ?, 'active', ?, ?)", siteId, "配额站", "q-" + uid, userId, now, now);
        jdbc.update("INSERT INTO pages (id, site_id, name, path, status, schema_json, created_at, updated_at) " +
                "VALUES (?, ?, '首页', '/', 'draft', '{}', ?, ?)", pageId, siteId, now, now);
        jdbc.update("INSERT INTO forms (id, site_id, page_id, name, field_schema_json, submit_config_json, " +
                        "dedup_keys_json, dedup_window, dedup_policy, status, created_at, updated_at) " +
                        "VALUES (?, ?, ?, '报名表', '[]', '{}', '[\"phone\"]', 0, 'reject', 'active', ?, ?)",
                formId, siteId, pageId, now, now);
        jdbc.update("DELETE FROM usage_counters WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM leads WHERE site_id = ?", siteId);
    }

    private MockHttpServletRequestBuilder owner(MockHttpServletRequestBuilder b) {
        return b.contextPath("/backend").header("X-User-ID", userId).header("X-User-Role", "user");
    }

    @Test
    void quotaBlocksSecondPageAndSecondLeadWith429() throws Exception {
        // 1) hidden 套餐可直接下单（visible 过滤不影响订阅校验）
        mockMvc.perform(owner(post("/backend/billing/orders"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"e2e-tiny\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.status").value("paid"));

        // 2) 第 1 个页面 201（quota_pages=1，已有 seed 首页不计入——配额按 usage_counters 计量）
        mockMvc.perform(owner(post("/backend/sites/" + siteId + "/pages"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"页面A\",\"path\":\"/a\",\"schema\":{\"root\":{}}}"))
                .andExpect(status().isCreated());

        // 3) 第 2 个页面 → 429 QUOTA_EXCEEDED(metric=pages, limit=1, used=1)
        mockMvc.perform(owner(post("/backend/sites/" + siteId + "/pages"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"页面B\",\"path\":\"/b\",\"schema\":{\"root\":{}}}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("QUOTA_EXCEEDED"))
                .andExpect(jsonPath("$.details.metric").value("pages"))
                .andExpect(jsonPath("$.details.limit").value(1))
                .andExpect(jsonPath("$.details.used").value(1));

        // 4) 第 1 条 lead 提交成功（公开端点，无 X-User-*）
        mockMvc.perform(post("/backend/lead/forms/" + formId + "/submit")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"formId\":\"" + formId + "\",\"contact\":{\"phone\":\"13800000001\"},\"pageId\":\"" + pageId + "\"}"))
                .andExpect(status().isOk());

        // 5) 第 2 条 lead（不同 phone，不触发去重）→ 429 QUOTA_EXCEEDED(metric=leads)
        mockMvc.perform(post("/backend/lead/forms/" + formId + "/submit")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"formId\":\"" + formId + "\",\"contact\":{\"phone\":\"13800000002\"},\"pageId\":\"" + pageId + "\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("QUOTA_EXCEEDED"))
                .andExpect(jsonPath("$.details.metric").value("leads"))
                .andExpect(jsonPath("$.details.limit").value(1))
                .andExpect(jsonPath("$.details.used").value(1)); // 对齐 pages 路径：拦截时 used=已用 1

        // 6) 原子累加落库：pages=1（第 2 次被拦截未累加）、leads=1
        assertThat(metricCount("pages")).isEqualTo(1);
        assertThat(metricCount("leads")).isEqualTo(1);

        // 7) /billing/usage 反映用量
        mockMvc.perform(owner(get("/backend/billing/usage")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pages").value(1))
                .andExpect(jsonPath("$.leads").value(1));
    }

    private long metricCount(String metric) {
        Long v = jdbc.queryForObject(
                "SELECT count FROM usage_counters WHERE user_id = ? AND period_month = ? AND metric = ?",
                Long.class, userId, com.luban.backend.service.QuotaService.currentPeriod(), metric);
        return v != null ? v : 0L;
    }
}
