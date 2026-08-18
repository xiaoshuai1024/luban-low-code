package com.luban.backend.contract;

import com.luban.backend.entity.Plan;
import com.luban.backend.mapper.OrderMapper;
import com.luban.backend.mapper.PlanMapper;
import com.luban.backend.mapper.SubscriptionMapper;
import com.luban.backend.mapper.TrialRecordMapper;
import com.luban.backend.service.TrialDowngradeJob;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * billing 域契约（T-be-3/T-be-4，plan §8.1/§9.2）：
 *
 *   GET  /billing/plans      裸数组三档（visible；priceMonthly=0；quota 字段）
 *   GET  /billing/me         free 回退 + usage/quota 快照
 *   POST /billing/subscribe  starter 首次 → trialing+14d；二次 → active；未知 → 400 INVALID_PLAN
 *   GET  /billing/usage      当月 period + 三指标；非法 period → 400
 *   POST /billing/orders     0 元直通：pending→paid 同事务 + applyPlan；重复下单幂等返回原单
 *   GET  /billing/orders     {items,total}
 *   未登录 → 401（AuthFilter RequireUser）
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BillingContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlanMapper planMapper;
    @Autowired private SubscriptionMapper subscriptionMapper;
    @Autowired private TrialRecordMapper trialRecordMapper;
    @Autowired private OrderMapper orderMapper;
    @Autowired private PlatformTransactionManager transactionManager;

    private String uid() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    /** 种子用户（billing 表 FK 需要）并返回其 id；X-User-Role=user。 */
    private String seedUser() {
        String id = "u-" + uid();
        Instant now = Instant.now();
        jdbc.update("INSERT INTO users (id, username, name, role, status, password, created_at, updated_at) " +
                        "VALUES (?, ?, ?, 'user', 'active', 'x', ?, ?)",
                id, "bill-" + id, "bill", now, now);
        return id;
    }

    private MockHttpServletRequestBuilder user(MockHttpServletRequestBuilder b, String userId) {
        return b.contextPath("/backend").header("X-User-ID", userId).header("X-User-Role", "user");
    }

    // === GET /billing/plans ===

    @Test
    void plansReturnsBareArrayOfThreeVisibleTiers() throws Exception {
        mockMvc.perform(user(get("/backend/billing/plans"), "any-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].planCode").value("free"))
                .andExpect(jsonPath("$[0].name").value("Free"))
                .andExpect(jsonPath("$[0].priceMonthly").value(0))
                .andExpect(jsonPath("$[0].quotaLeads").value(100))
                .andExpect(jsonPath("$[0].quotaPages").value(3))
                .andExpect(jsonPath("$[0].quotaVisits").value(0))
                .andExpect(jsonPath("$[0].trialDays").value(0))
                .andExpect(jsonPath("$[1].planCode").value("starter"))
                .andExpect(jsonPath("$[1].quotaLeads").value(1000))
                .andExpect(jsonPath("$[1].quotaPages").value(10))
                .andExpect(jsonPath("$[1].trialDays").value(14))
                .andExpect(jsonPath("$[2].planCode").value("growth"))
                .andExpect(jsonPath("$[2].quotaLeads").value(10000));
    }

    @Test
    void hiddenPlanExcludedFromListing() throws Exception {
        // e2e-tiny 由 E2EBillingPlanBootstrap 注入（hidden），默认测试上下文未启用——
        // 这里直接模拟 hidden 档后断言列表仍只有 3 档（visible 过滤）
        String code = "hidden-" + uid();
        jdbc.update("INSERT INTO plans (plan_code, name, status, price_monthly, quota_leads, quota_pages, quota_visits, gates, trial_days, sort_order) " +
                "VALUES (?, ?, 'hidden', 0, 1, 1, 0, NULL, 0, 99)", code, "Hidden");
        try {
            mockMvc.perform(user(get("/backend/billing/plans"), "any-user"))
                    .andExpect(jsonPath("$.length()").value(3));
        } finally {
            jdbc.update("DELETE FROM plans WHERE plan_code = ?", code);
        }
    }

    @Test
    void billingEndpointsRequireLogin() throws Exception {
        mockMvc.perform(get("/backend/billing/plans").contextPath("/backend"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mockMvc.perform(get("/backend/billing/me").contextPath("/backend"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mockMvc.perform(get("/backend/billing/orders").contextPath("/backend"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    // === GET /billing/me ===

    @Test
    void meFallsBackToFreeWithZeroUsageWithoutSubscription() throws Exception {
        String userId = seedUser();
        mockMvc.perform(user(get("/backend/billing/me"), userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planCode").value("free"))
                .andExpect(jsonPath("$.planName").value("Free"))
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.trialEndsAt").doesNotExist())
                .andExpect(jsonPath("$.usage.leads").value(0))
                .andExpect(jsonPath("$.usage.pages").value(0))
                .andExpect(jsonPath("$.usage.visits").value(0))
                .andExpect(jsonPath("$.quota.leads").value(100))
                .andExpect(jsonPath("$.quota.pages").value(3));
    }

    // === POST /billing/subscribe ===

    @Test
    void subscribeStarterFirstTimeEntersTrialWith14Days() throws Exception {
        String userId = seedUser();
        mockMvc.perform(user(post("/backend/billing/subscribe"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"starter\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscription.planCode").value("starter"))
                .andExpect(jsonPath("$.subscription.status").value("trialing"))
                .andExpect(jsonPath("$.subscription.trialEndsAt").exists());

        var row = jdbc.queryForMap(
                "SELECT plan_code, status, trial_ends_at FROM subscriptions WHERE user_id = ?", userId);
        org.assertj.core.api.Assertions.assertThat(row.get("plan_code")).isEqualTo("starter");
        org.assertj.core.api.Assertions.assertThat(row.get("status")).isEqualTo("trialing");
        // trial_ends_at = now + 14d（区间断言容许时钟偏移：[now+13d, now+15d]）
        Object rawEnds = row.get("trial_ends_at");
        Instant trialEnds = rawEnds instanceof Instant i ? i : ((java.sql.Timestamp) rawEnds).toInstant();
        Instant now = Instant.now();
        assertThat(trialEnds).isAfter(now.plus(Duration.ofDays(13)));
        assertThat(trialEnds).isBefore(now.plus(Duration.ofDays(15)));
        Integer trialRows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM trial_records WHERE user_id = ? AND plan_code = 'starter'",
                Integer.class, userId);
        org.assertj.core.api.Assertions.assertThat(trialRows).isEqualTo(1);
    }

    @Test
    void subscribeStarterSecondTimeIsActiveWithoutTrial() throws Exception {
        String userId = seedUser();
        Instant now = Instant.now();
        // 已有 starter 试用记录（uk_trial_user_plan）→「首次」判定不成立
        jdbc.update("INSERT INTO trial_records (id, user_id, plan_code, started_at, ends_at, converted_to, created_at) " +
                "VALUES (?, ?, 'starter', ?, ?, 'free', ?)",
                "tr-" + uid(), userId, now.minusSeconds(86400L * 20), now.minusSeconds(86400L * 6), now);

        mockMvc.perform(user(post("/backend/billing/subscribe"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"starter\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscription.status").value("active"))
                .andExpect(jsonPath("$.subscription.trialEndsAt").doesNotExist());
    }

    @Test
    void subscribeGrowthHasNoTrial() throws Exception {
        String userId = seedUser();
        mockMvc.perform(user(post("/backend/billing/subscribe"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"growth\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscription.planCode").value("growth"))
                .andExpect(jsonPath("$.subscription.status").value("active"));
    }

    @Test
    void subscribeUnknownPlanReturns400() throws Exception {
        String userId = seedUser();
        mockMvc.perform(user(post("/backend/billing/subscribe"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"nonexistent\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PLAN"));
    }

    // === GET /billing/usage ===

    @Test
    void usageReturnsCurrentPeriod() throws Exception {
        String userId = seedUser();
        String expectedPeriod = java.time.ZonedDateTime.now(java.time.ZoneOffset.UTC)
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM"));
        mockMvc.perform(user(get("/backend/billing/usage"), userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.period").value(expectedPeriod))
                .andExpect(jsonPath("$.leads").value(0))
                .andExpect(jsonPath("$.pages").value(0))
                .andExpect(jsonPath("$.visits").value(0));
    }

    @Test
    void usageRejectsBadPeriodFormat() throws Exception {
        mockMvc.perform(user(get("/backend/billing/usage"), seedUser()).queryParam("period", "2026-13"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ARGUMENT"));
    }

    // === POST/GET /billing/orders（0 元直通 + 幂等） ===

    @Test
    void zeroAmountOrderIsPaidAtomicallyAndAppliesPlan() throws Exception {
        String userId = seedUser();
        mockMvc.perform(user(post("/backend/billing/orders"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"starter\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.orderNo").isNotEmpty())
                .andExpect(jsonPath("$.order.planCode").value("starter"))
                .andExpect(jsonPath("$.order.amount").value(0))
                .andExpect(jsonPath("$.order.status").value("paid"))
                .andExpect(jsonPath("$.order.paidAt").exists())
                .andExpect(jsonPath("$.order.createdAt").exists())
                .andExpect(jsonPath("$.subscription.status").value("trialing"));

        // 落库：无残留 pending 订单（同事务 pending→paid）
        Integer pending = jdbc.queryForObject(
                "SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = 'pending'", Integer.class, userId);
        org.assertj.core.api.Assertions.assertThat(pending).isZero();
    }

    @Test
    void repeatedOrderForSamePlanIsIdempotent() throws Exception {
        String userId = seedUser();
        String first = mockMvc.perform(user(post("/backend/billing/orders"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"growth\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String firstOrderNo = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(first).at("/order/orderNo").asText();

        String second = mockMvc.perform(user(post("/backend/billing/orders"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"growth\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String secondOrderNo = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(second).at("/order/orderNo").asText();

        org.assertj.core.api.Assertions.assertThat(secondOrderNo).isEqualTo(firstOrderNo);
        Integer total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM orders WHERE user_id = ?", Integer.class, userId);
        org.assertj.core.api.Assertions.assertThat(total).isEqualTo(1);
    }

    @Test
    void orderUnknownPlanReturns400() throws Exception {
        mockMvc.perform(user(post("/backend/billing/orders"), seedUser())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"ghost\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PLAN"));
    }

    @Test
    void ordersListReturnsItemsAndTotal() throws Exception {
        String userId = seedUser();
        mockMvc.perform(user(post("/backend/billing/orders"), userId)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"planCode\":\"growth\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(user(get("/backend/billing/orders"), userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].planCode").value("growth"))
                .andExpect(jsonPath("$.items[0].status").value("paid"));
    }

    // === PlanMapper gates 列映射回归（COLS gates AS gates_json） ===

    @Test
    void planGatesJsonRoundTripsThroughMapper() {
        String code = "gates-" + uid();
        jdbc.update("INSERT INTO plans (plan_code, name, status, price_monthly, quota_leads, quota_pages, quota_visits, gates, trial_days, sort_order) " +
                        "VALUES (?, ?, 'hidden', 0, 1, 1, 0, ?, 0, 98)", code, "Gates", "{\"a\":1}");
        try {
            Plan plan = planMapper.getByCode(code);
            org.assertj.core.api.Assertions.assertThat(plan).isNotNull();
            // gates 列须映射到 gatesJson（别名断裂时恒为 null）
            org.assertj.core.api.Assertions.assertThat(plan.getGatesJson()).isEqualTo("{\"a\":1}");
        } finally {
            jdbc.update("DELETE FROM plans WHERE plan_code = ?", code);
        }
    }

    // === T-be-7 到期降级边界（真实 H2 + 固定时钟驱动 TrialDowngradeJob 全逻辑） ===

    /** 以固定时钟组装 job（对齐生产构造：mapper + TransactionTemplate + Clock）。 */
    private TrialDowngradeJob downgradeJobAt(Instant now) {
        return new TrialDowngradeJob(subscriptionMapper, trialRecordMapper,
                new TransactionTemplate(transactionManager), Clock.fixed(now, ZoneOffset.UTC));
    }

    /** 种 trialing 订阅行 + 对应 trial_records（converted_to 未回填）。 */
    private void seedTrialingSubscription(String userId, Instant trialStartedAt, Instant trialEndsAt) {
        Instant now = Instant.now();
        jdbc.update("INSERT INTO subscriptions (user_id, plan_code, status, started_at, expires_at, " +
                        "trial_started_at, trial_ends_at, created_at, updated_at) " +
                        "VALUES (?, 'starter', 'trialing', ?, NULL, ?, ?, ?, ?)",
                userId, trialStartedAt, trialStartedAt, trialEndsAt, now, now);
        jdbc.update("INSERT INTO trial_records (id, user_id, plan_code, started_at, ends_at, converted_to, created_at) " +
                        "VALUES (?, ?, 'starter', ?, ?, NULL, ?)",
                "tr-dg-" + uid(), userId, trialStartedAt, trialEndsAt, now);
    }

    /** 试用进行到第 13.9 天（trial_ends_at = now+0.1d，未到期）→ 不降级、不回填。 */
    @Test
    void trialAt13Point9DaysIsNotDowngraded() {
        String userId = seedUser();
        Instant now = Instant.now();
        Instant startedAt = now.minus(Duration.ofDays(14)).plus(Duration.ofMinutes(144)); // 13.9d 前
        seedTrialingSubscription(userId, startedAt, startedAt.plus(Duration.ofDays(14))); // ends = now+0.1d

        downgradeJobAt(now).downgradeExpiredTrials();

        var row = jdbc.queryForMap(
                "SELECT plan_code, status, trial_started_at, trial_ends_at FROM subscriptions WHERE user_id = ?", userId);
        assertThat(row.get("plan_code")).isEqualTo("starter");
        assertThat(row.get("status")).isEqualTo("trialing");
        assertThat(row.get("trial_ends_at")).isNotNull();
        Integer converted = jdbc.queryForObject(
                "SELECT COUNT(*) FROM trial_records WHERE user_id = ? AND converted_to IS NOT NULL",
                Integer.class, userId);
        assertThat(converted).isZero();
    }

    /** 试用进行到第 14.1 天（trial_ends_at = now-0.1d，已到期）→ 降 free/active + converted_to='free' 回填。 */
    @Test
    void trialAt14Point1DaysDowngradedToFreeWithConvertedBackfill() {
        String userId = seedUser();
        Instant now = Instant.now();
        Instant startedAt = now.minus(Duration.ofDays(14)).minus(Duration.ofMinutes(144)); // 14.1d 前
        seedTrialingSubscription(userId, startedAt, startedAt.plus(Duration.ofDays(14))); // ends = now-0.1d

        downgradeJobAt(now).downgradeExpiredTrials();

        var row = jdbc.queryForMap(
                "SELECT plan_code, status, trial_started_at, trial_ends_at FROM subscriptions WHERE user_id = ?", userId);
        assertThat(row.get("plan_code")).isEqualTo("free");
        assertThat(row.get("status")).isEqualTo("active");
        assertThat(row.get("trial_started_at")).isNull();
        assertThat(row.get("trial_ends_at")).isNull();
        String convertedTo = jdbc.queryForObject(
                "SELECT converted_to FROM trial_records WHERE user_id = ? AND plan_code = 'starter'",
                String.class, userId);
        assertThat(convertedTo).isEqualTo("free");
    }

    // === applyPlan 已有订阅行 → update 分支（T-be-3 状态机） ===

    /** starter 首订生效（trialing）后再 order growth：仍单行，换档 active 且 trial 字段清空。 */
    @Test
    void applyPlanOnExistingSubscriptionRowUpdatesInPlaceKeepingSingleRow() throws Exception {
        String userId = seedUser();
        mockMvc.perform(user(post("/backend/billing/subscribe"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"starter\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscription.status").value("trialing"));

        mockMvc.perform(user(post("/backend/billing/orders"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"growth\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscription.planCode").value("growth"))
                .andExpect(jsonPath("$.subscription.status").value("active"));

        Integer rows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM subscriptions WHERE user_id = ?", Integer.class, userId);
        assertThat(rows).isEqualTo(1); // 已有行走 update，不插新行
        var row = jdbc.queryForMap(
                "SELECT plan_code, status, trial_started_at, trial_ends_at FROM subscriptions WHERE user_id = ?", userId);
        assertThat(row.get("plan_code")).isEqualTo("growth");
        assertThat(row.get("status")).isEqualTo("active");
        assertThat(row.get("trial_started_at")).isNull(); // 换档清 trial 残留
        assertThat(row.get("trial_ends_at")).isNull();
    }

    // === OrderMapper.markPaid 幂等（0 元直通 SQL 守卫） ===

    /** markPaid 限定 status='pending'：对已 paid 行再调用影响 0 行（不重复支付）。 */
    @Test
    void markPaidOnAlreadyPaidOrderAffectsZeroRows() {
        String userId = seedUser();
        String orderId = "ord-" + uid();
        Instant now = Instant.now();
        jdbc.update("INSERT INTO orders (id, order_no, user_id, plan_code, amount, status, paid_at, created_at, updated_at) " +
                        "VALUES (?, ?, ?, 'growth', 0, 'paid', ?, ?, ?)",
                orderId, "no-" + orderId, userId, now, now, now);

        int updated = orderMapper.markPaid(orderId, now.plusSeconds(60), now.plusSeconds(60));

        assertThat(updated).isZero();
    }
}
