package com.luban.backend.service;

import com.luban.backend.dto.OrderCreateResponse;
import com.luban.backend.dto.OrderResponse;
import com.luban.backend.entity.Order;
import com.luban.backend.entity.Plan;
import com.luban.backend.entity.Subscription;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.OrderMapper;
import com.luban.backend.mapper.PlanMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
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
 *   lockForMutation(用户行锁) → orders INSERT(pending) → amount==0 自动支付（status=paid + paid_at）
 *                            + SubscriptionService.applyPlanInternal（订阅生效）
 *
 *  - 同用户并发下单先在 subscriptions 行锁上排队（行不存在时插 free 占位抢主键锁），
 *    使 paid 幂等判定可靠读到先提交者的订单（0 元直通幂等竞态防护）；
 *  - amount>0 → 400 PAYMENT_NOT_SUPPORTED（未来接网关的挂载点，本期三档全 0 元不可达防御）；
 *  - order_no 幂等：同用户同套餐已存在 paid 订单 → 幂等返回原单（§3.2「取幂等返回」），
 *    order_no 本身由 UUID 派生保证全局唯一（uk_orders_order_no 兜底）；
 *  - 事务边界：直调 SubscriptionService.applyPlanInternal（包内方法、无 @Transactional，
 *    同包直调不经代理）——若改调带事务注解的 public applyPlan，内层 REQUIRED 参与方抛异常
 *    穿越代理会把本事务标记 rollback-only，下方 catch 后提交抛 UnexpectedRollbackException；
 *  - 防御纵深（锁序统一后正常路径不可达，纯防御）：applyPlanInternal 撞 trial_records uk →
 *    本单让位删除、重查按幂等收敛返回原单；
 *  - 重复对 paid 订单支付不再有入口（幂等返回即 §3.2 非法态的收敛方式）。
 */
@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
    private static final String STATUS_PENDING = "pending";
    private static final String STATUS_PAID = "paid";
    private static final int MAX_PAGE = 100_000; // offset 上限 (1e5-1)*100 ≈ 1e7，防 int 溢出

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
        // 串行化点：先锁该用户 subscriptions 行（无则插 free 占位），同用户并发下单在此排队，
        // 保证后续 paid 幂等判定发生在锁内（能读到先提交者已支付的原单）
        subscriptionService.lockForMutation(userId);
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
        try {
            // 直调包内无事务注解的内部方法（不经代理）：异常不在内层事务边界被拦截，
            // 本事务不会被标记 rollback-only，catch 后仍可正常提交
            Subscription subscription = subscriptionService.applyPlanInternal(userId, plan.getPlanCode());
            // 审计日志（字段均非敏感：单号/用户/套餐/金额）
            log.info("order paid: orderNo={} userId={} planCode={} amount={}",
                    order.getOrderNo(), userId, plan.getPlanCode(), amount);
            return new OrderCreateResponse(OrderResponse.fromEntity(order), subscriptionService.toResponse(subscription));
        } catch (DuplicateKeyException e) {
            // 防御纵深（applyPlanInternal 已先锁 subscriptions 行，正常路径 uk_trial_user_plan
            // 冲突不可达；此处兜底隔离级别/外部直插等场景）：trial_records 撞 uk →
            // 本单让位删除，重查按幂等收敛返回先提交者的原单
            orderMapper.deleteByIdAndUser(order.getId(), userId);
            Order winner = orderMapper.findLatestPaidByUserAndPlan(userId, plan.getPlanCode());
            if (winner == null) {
                throw e;
            }
            return new OrderCreateResponse(OrderResponse.fromEntity(winner),
                    subscriptionService.toResponse(subscriptionService.getOrFallback(userId)));
        }
    }

    /** 订单分页列表（{items,total}，AGENT_RULES §4 分页规范）。 */
    public Map<String, Object> listOrders(String userId, int page, int size) {
        int safePage = Math.min(Math.max(1, page), MAX_PAGE); // clamp 防 offset 溢出
        int safeSize = Math.min(Math.max(1, size), 100);
        int offset = (safePage - 1) * safeSize; // ≤ (1e5-1)*100，int 安全
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
