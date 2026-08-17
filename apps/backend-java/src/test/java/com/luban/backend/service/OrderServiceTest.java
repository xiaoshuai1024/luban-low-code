package com.luban.backend.service;

import com.luban.backend.dto.OrderCreateResponse;
import com.luban.backend.entity.Order;
import com.luban.backend.entity.Plan;
import com.luban.backend.entity.Subscription;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.OrderMapper;
import com.luban.backend.mapper.PlanMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Order 状态机穷举单测（plan §8.1 T-be-4）：
 * (无) --create--> pending --amount==0 自动支付--> paid（同事务 + applyPlan）；
 * amount>0 → PAYMENT_NOT_SUPPORTED；未知套餐 → INVALID_PLAN；
 * 已有同套餐 paid 单 → 幂等返回原单；markPaid 0 行 → ORDER_ALREADY_PAID。
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    private static final String USER_ID = "user-1";

    @Mock private OrderMapper orderMapper;
    @Mock private PlanMapper planMapper;
    @Mock private SubscriptionService subscriptionService;

    private OrderService service;

    @BeforeEach
    void setup() {
        service = new OrderService(orderMapper, planMapper, subscriptionService);
    }

    private Plan plan(String code, long price, int trialDays) {
        Plan p = new Plan();
        p.setPlanCode(code);
        p.setName(code);
        p.setPriceMonthly(price);
        p.setTrialDays(trialDays);
        return p;
    }

    @Test
    void zeroAmountOrderGoesPendingThenPaidAndAppliesPlanInOneCall() {
        when(planMapper.getByCode("growth")).thenReturn(plan("growth", 0, 0));
        when(orderMapper.findLatestPaidByUserAndPlan(USER_ID, "growth")).thenReturn(null);
        when(orderMapper.markPaid(any(), any(), any())).thenReturn(1);
        Subscription sub = new Subscription();
        sub.setUserId(USER_ID);
        sub.setPlanCode("growth");
        sub.setStatus("active");
        when(subscriptionService.applyPlan(USER_ID, "growth")).thenReturn(sub);
        when(subscriptionService.toResponse(sub)).thenReturn(
                new com.luban.backend.dto.SubscriptionResponse("growth", "Growth", "active", Instant.now(), null));

        OrderCreateResponse result = service.createOrder(USER_ID, "growth");

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderMapper).insert(captor.capture());
        Order inserted = captor.getValue();
        // 插入即 0 元（不可达非 0 分支）；order_no ORD+32 位 hex（uk_orders_order_no 兜底）
        assertThat(inserted.getAmount()).isZero();
        assertThat(inserted.getOrderNo()).startsWith("ORD").hasSize(3 + 32);
        // 同一调用内：先 INSERT（pending 起始态）后 markPaid（SQL 限定 status='pending' 幂等）
        org.mockito.InOrder inOrder = org.mockito.Mockito.inOrder(orderMapper);
        inOrder.verify(orderMapper).insert(any(Order.class));
        inOrder.verify(orderMapper).markPaid(eq(inserted.getId()), any(), any());
        verify(subscriptionService).applyPlan(USER_ID, "growth"); // 订阅生效同事务

        assertThat(result.order().status()).isEqualTo("paid");
        assertThat(result.order().paidAt()).isNotNull();
        assertThat(result.subscription().planCode()).isEqualTo("growth");
    }

    @Test
    void nonZeroAmountThrowsPaymentNotSupported() {
        when(planMapper.getByCode("paid-tier")).thenReturn(plan("paid-tier", 9900, 0));
        when(orderMapper.findLatestPaidByUserAndPlan(USER_ID, "paid-tier")).thenReturn(null);

        assertThatThrownBy(() -> service.createOrder(USER_ID, "paid-tier"))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("PAYMENT_NOT_SUPPORTED");
                    assertThat(e.getHttpStatus().value()).isEqualTo(400);
                });
        verify(orderMapper, never()).insert(any());
        verify(subscriptionService, never()).applyPlan(any(), any());
    }

    @Test
    void unknownPlanThrowsInvalidPlan() {
        when(planMapper.getByCode("ghost")).thenReturn(null);
        assertThatThrownBy(() -> service.createOrder(USER_ID, "ghost"))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo("INVALID_PLAN"));
        verify(orderMapper, never()).insert(any());
    }

    @Test
    void existingPaidOrderForSamePlanIsReturnedIdempotently() {
        when(planMapper.getByCode("growth")).thenReturn(plan("growth", 0, 0));
        Order existing = new Order();
        existing.setId("order-existing");
        existing.setOrderNo("ORDEXISTING");
        existing.setUserId(USER_ID);
        existing.setPlanCode("growth");
        existing.setAmount(0);
        existing.setStatus("paid");
        existing.setPaidAt(Instant.now().minusSeconds(60));
        existing.setCreatedAt(Instant.now().minusSeconds(61));
        when(orderMapper.findLatestPaidByUserAndPlan(USER_ID, "growth")).thenReturn(existing);
        Subscription sub = new Subscription();
        sub.setUserId(USER_ID);
        sub.setPlanCode("growth");
        sub.setStatus("active");
        lenient().when(subscriptionService.getOrFallback(USER_ID)).thenReturn(sub);
        lenient().when(subscriptionService.toResponse(sub)).thenReturn(
                new com.luban.backend.dto.SubscriptionResponse("growth", "Growth", "active", Instant.now(), null));

        OrderCreateResponse result = service.createOrder(USER_ID, "growth");

        assertThat(result.order().orderNo()).isEqualTo("ORDEXISTING");
        verify(orderMapper, never()).insert(any());
        verify(subscriptionService, never()).applyPlan(any(), any()); // 不重复支付/换档
    }

    @Test
    void markPaidNoRowsThrowsOrderAlreadyPaid() {
        when(planMapper.getByCode("growth")).thenReturn(plan("growth", 0, 0));
        when(orderMapper.findLatestPaidByUserAndPlan(USER_ID, "growth")).thenReturn(null);
        when(orderMapper.markPaid(any(), any(), any())).thenReturn(0);

        assertThatThrownBy(() -> service.createOrder(USER_ID, "growth"))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo("ORDER_ALREADY_PAID"));
    }

    @Test
    void listOrdersReturnsItemsWithTotal() {
        when(orderMapper.listByUserId(eq(USER_ID), eq(0), eq(10))).thenReturn(java.util.List.of());
        when(orderMapper.countByUserId(USER_ID)).thenReturn(7L);

        var page = service.listOrders(USER_ID, 1, 10);

        assertThat(page.get("total")).isEqualTo(7L);
        assertThat(page.get("items")).isEqualTo(java.util.List.of());
    }

    @Test
    void listOrdersNormalizesPageAndClampsSize() {
        service.listOrders(USER_ID, 0, 999);
        verify(orderMapper).listByUserId(eq(USER_ID), eq(0), eq(100));
    }

    @Test
    void listOrdersClampsHugePageToPreventOffsetOverflow() {
        when(orderMapper.listByUserId(eq(USER_ID), eq(9_999_900), eq(100))).thenReturn(java.util.List.of());
        when(orderMapper.countByUserId(USER_ID)).thenReturn(0L);

        service.listOrders(USER_ID, Integer.MAX_VALUE, 100);

        // page clamp ≤ 100000 → offset 上限 (1e5-1)*100，int 不溢出
        verify(orderMapper).listByUserId(eq(USER_ID), eq(9_999_900), eq(100));
    }
}
