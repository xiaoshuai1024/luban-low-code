package com.luban.backend.service;

import com.luban.backend.entity.Order;
import com.luban.backend.entity.TrialRecord;
import com.luban.backend.mapper.OrderMapper;
import com.luban.backend.mapper.TrialRecordMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 事务边界回归（R2-F11，Failsafe IT）：createOrder 的 catch DuplicateKeyException
 * 幂等收敛必须真正生效——内层换档调用不得经过第二层 @Transactional 代理边界。
 *
 * 机理：若 OrderService 直调带事务注解的 SubscriptionService.applyPlan（REQUIRED 加入
 * 支付事务），trial_records 撞 uk 抛异常穿越内层代理时会把共享事务标记 rollback-only；
 * 外层 catch 后提交抛 UnexpectedRollbackException → 500。修复后 OrderService 直调包内
 * 无注解的 applyPlanInternal（同包直调不经代理），catch 让位删除+重查后正常提交 → 200。
 *
 * 手法：@SpringBootTest 走 controller → OrderService 真实 @Transactional 代理；
 * @SpyBean TrialRecordMapper 在 trial_records INSERT 处抛 DuplicateKeyException（H2
 * 消息文案），模拟「幂等判定未见的并发首单」；@SpyBean OrderMapper 让首次 paid 幂等
 * 判定为空、让位重查时返回赢家原单（单线程下复现「先提交者已 paid」的时序）。
 *
 * 注意：本类不加 @Transactional（测试事务会使服务加入同一事务、响应先行写出，
 * 无法暴露 UnexpectedRollbackException）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderTransactionBoundaryIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @SpyBean private TrialRecordMapper trialRecordMapper;
    @SpyBean private OrderMapper orderMapper;

    private String uid() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    /** 种子用户（billing 表 FK 需要）并返回其 id；X-User-Role=user。 */
    private String seedUser() {
        String id = "u-" + uid();
        Instant now = Instant.now();
        jdbc.update("INSERT INTO users (id, username, name, role, status, password, created_at, updated_at) " +
                        "VALUES (?, ?, ?, 'user', 'active', 'x', ?, ?)",
                id, "txb-" + id, "txb", now, now);
        return id;
    }

    private MockHttpServletRequestBuilder user(MockHttpServletRequestBuilder b, String userId) {
        return b.contextPath("/backend").header("X-User-ID", userId).header("X-User-Role", "user");
    }

    /**
     * applyPlan 抛 DuplicateKeyException（trial_records 撞 uk_trial_user_plan）时，
     * 外层 catch 让位删除 + 重查幂等收敛返回赢家原单 → 200，而非 rollback-only 陷阱的
     * UnexpectedRollbackException（500）。若内层换档调用回归到带 @Transactional 的
     * 代理边界（public applyPlan），本用例即红。
     */
    @Test
    void duplicateKeyInsideOrderTransactionIsIdempotentlyAbsorbedNotUnexpectedRollback() throws Exception {
        String userId = seedUser();
        Instant now = Instant.now();
        // 订阅行已存在（free/active）：lockForMutation 走已有行锁
        jdbc.update("INSERT INTO subscriptions (user_id, plan_code, status, started_at, expires_at, " +
                        "trial_started_at, trial_ends_at, created_at, updated_at) " +
                        "VALUES (?, 'free', 'active', ?, NULL, NULL, NULL, ?, ?)",
                userId, now, now, now);
        // 并发赢家的已支付原单（仅响应体用；不落库——首次幂等判定不能看到它）
        Order winner = new Order();
        winner.setId("ord-winner-" + uid());
        winner.setOrderNo("ORDWINNER" + uid());
        winner.setUserId(userId);
        winner.setPlanCode("starter");
        winner.setAmount(0);
        winner.setStatus("paid");
        winner.setPaidAt(now);
        winner.setCreatedAt(now);
        winner.setUpdatedAt(now);
        // 首次 paid 幂等判定：无已支付单（放行下单）→ 让位重查：返回赢家原单
        doReturn(null, winner).when(orderMapper).findLatestPaidByUserAndPlan(userId, "starter");
        // trial_records INSERT 撞 uk_trial_user_plan（隔离级别下幂等判定未见的并发首单）
        doThrow(new DuplicateKeyException("Unique index or primary key violation: uk_trial_user_plan"))
                .when(trialRecordMapper).insert(any(TrialRecord.class));

        mockMvc.perform(user(post("/backend/billing/orders"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"starter\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.orderNo").value(winner.getOrderNo()))
                .andExpect(jsonPath("$.order.status").value("paid"))
                .andExpect(jsonPath("$.subscription.planCode").value("free"));

        // 让位删除生效：本单（请求内 INSERT 的订单）已删，无试用记录残留
        Integer orders = jdbc.queryForObject(
                "SELECT COUNT(*) FROM orders WHERE user_id = ?", Integer.class, userId);
        assertThat(orders).isZero();
        Integer trials = jdbc.queryForObject(
                "SELECT COUNT(*) FROM trial_records WHERE user_id = ?", Integer.class, userId);
        assertThat(trials).isZero();
        // 订阅行未被半改（trial 插入在订阅 update 之前抛出，事务内无残留半状态）
        var row = jdbc.queryForMap(
                "SELECT plan_code, status FROM subscriptions WHERE user_id = ?", userId);
        assertThat(row.get("plan_code")).isEqualTo("free");
        assertThat(row.get("status")).isEqualTo("active");
    }

    /**
     * 同 user+plan 已有 trial_record 且订阅行存在 → createOrder 不再尝试试用插入
     * （「首次试用」判定不成立），200 直购 active、无 uk 冲突、无新试用记录。
     * 同时覆盖 applyPlanInternal 先 lockForMutation 的已有行路径（锁序修复回归）。
     */
    @Test
    void createOrderWithExistingTrialRecordAndSubscriptionRowReturns200() throws Exception {
        String userId = seedUser();
        Instant now = Instant.now();
        // 订阅行存在（starter/trialing，试用已过期形态）+ 对应 trial_record（uk_trial_user_plan）
        jdbc.update("INSERT INTO subscriptions (user_id, plan_code, status, started_at, expires_at, " +
                        "trial_started_at, trial_ends_at, created_at, updated_at) " +
                        "VALUES (?, 'starter', 'trialing', ?, NULL, ?, ?, ?, ?)",
                userId, now.minus(Duration.ofDays(15)), now.minus(Duration.ofDays(15)),
                now.minus(Duration.ofDays(1)), now, now);
        jdbc.update("INSERT INTO trial_records (id, user_id, plan_code, started_at, ends_at, converted_to, created_at) " +
                        "VALUES (?, ?, 'starter', ?, ?, NULL, ?)",
                "tr-txb-" + uid(), userId, now.minus(Duration.ofDays(15)), now.minus(Duration.ofDays(1)), now);

        mockMvc.perform(user(post("/backend/billing/orders"), userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"starter\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.status").value("paid"))
                .andExpect(jsonPath("$.order.amount").value(0))
                .andExpect(jsonPath("$.subscription.planCode").value("starter"))
                .andExpect(jsonPath("$.subscription.status").value("active"));

        // 幂等收敛后：无新增 trial_record、无 pending 残留、订阅仍单行 active
        Integer trials = jdbc.queryForObject(
                "SELECT COUNT(*) FROM trial_records WHERE user_id = ?", Integer.class, userId);
        assertThat(trials).isEqualTo(1);
        Integer pending = jdbc.queryForObject(
                "SELECT COUNT(*) FROM orders WHERE user_id = ? AND status = 'pending'", Integer.class, userId);
        assertThat(pending).isZero();
        Integer subRows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM subscriptions WHERE user_id = ?", Integer.class, userId);
        assertThat(subRows).isEqualTo(1);
    }
}
