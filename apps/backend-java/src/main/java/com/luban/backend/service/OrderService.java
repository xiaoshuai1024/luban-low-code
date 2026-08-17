package com.luban.backend.service;

import com.luban.backend.dto.OrderCreateResponse;
import com.luban.backend.dto.OrderResponse;
import com.luban.backend.entity.Order;
import com.luban.backend.entity.Plan;
import com.luban.backend.entity.Subscription;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.OrderMapper;
import com.luban.backend.mapper.PlanMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 订单服务（T-be-4）。0 元直通单事务（plan §3.3）：
 *
 *   orders INSERT(pending) → amount==0 自动支付（status=paid + paid_at）
 *                          + SubscriptionService.applyPlan（订阅生效）
 *
 *  - amount>0 → 400 PAYMENT_NOT_SUPPORTED（未来接网关的挂载点，本期三档全 0 元不可达防御）；
 *  - order_no 幂等：同用户同套餐已存在 paid 订单 → 幂等返回原单（§3.2「取幂等返回」），
 *    order_no 本身由 UUID 派生保证全局唯一（uk_orders_order_no 兜底）；
 *  - 重复对 paid 订单支付不再有入口（幂等返回即 §3.2 非法态的收敛方式）。
 */
@Service
public class OrderService {

    private static final String STATUS_PENDING = "pending";
    private static final String STATUS_PAID = "paid";

    private final OrderMapper orderMapper;
    private final PlanMapper planMapper;
    private final SubscriptionService subscriptionService;

    public OrderService(OrderMapper orderMapper, PlanMapper planMapper, SubscriptionService subscriptionService) {
        this.orderMapper = orderMapper;
        this.planMapper = planMapper;
        this.subscriptionService = subscriptionService;
    }

    @Transactional(rollbackFor = Exception.class)
    public OrderCreateResponse createOrder(String userId, String planCode) {
        Plan plan = planMapper.getByCode(planCode);
        if (plan == null) {
            throw BusinessException.invalidPlan();
        }
        // 幂等：同套餐已有已支付订单 → 返回原单（不重复支付、不重复 applyPlan）
        Order existingPaid = orderMapper.findLatestPaidByUserAndPlan(userId, plan.getPlanCode());
        if (existingPaid != null) {
            return new OrderCreateResponse(
                    OrderResponse.fromEntity(existingPaid),
                    subscriptionService.toResponse(subscriptionService.getOrFallback(userId)));
        }
        long amount = plan.getPriceMonthly();
        if (amount != 0) {
            throw BusinessException.paymentNotSupported();
        }
        Instant now = Instant.now();
        Order order = new Order();
        order.setId(UUID.randomUUID().toString());
        order.setOrderNo(generateOrderNo());
        order.setUserId(userId);
        order.setPlanCode(plan.getPlanCode());
        order.setAmount(amount);
        order.setStatus(STATUS_PENDING);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        orderMapper.insert(order);
        // 0 元自动支付成功（同事务；失败整体回滚，无半支付状态）
        int paid = orderMapper.markPaid(order.getId(), now, now);
        if (paid == 0) {
            throw BusinessException.orderAlreadyPaid();
        }
        order.setStatus(STATUS_PAID);
        order.setPaidAt(now);
        Subscription subscription = subscriptionService.applyPlan(userId, plan.getPlanCode());
        return new OrderCreateResponse(OrderResponse.fromEntity(order), subscriptionService.toResponse(subscription));
    }

    /** 订单分页列表（{items,total}，AGENT_RULES §4 分页规范）。 */
    public Map<String, Object> listOrders(String userId, int page, int size) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(Math.max(1, size), 100);
        int offset = (safePage - 1) * safeSize;
        List<Order> orders = orderMapper.listByUserId(userId, offset, safeSize);
        long total = orderMapper.countByUserId(userId);
        List<OrderResponse> items = orders.stream().map(OrderResponse::fromEntity).collect(Collectors.toList());
        return Map.of("items", items, "total", total);
    }

    /** order_no：ORD + UUID hex（32 位），uk_orders_order_no 唯一键兜底。 */
    static String generateOrderNo() {
        return "ORD" + UUID.randomUUID().toString().replace("-", "");
    }
}
