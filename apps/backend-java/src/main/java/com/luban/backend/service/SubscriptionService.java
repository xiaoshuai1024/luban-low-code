package com.luban.backend.service;

import com.luban.backend.entity.Plan;
import com.luban.backend.entity.Subscription;
import com.luban.backend.entity.TrialRecord;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.PlanMapper;
import com.luban.backend.mapper.SubscriptionMapper;
import com.luban.backend.mapper.TrialRecordMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 订阅服务（T-be-3）。状态机（plan §3.2）：
 *
 *   (无) --verify 激活--> active(Free)                      [bindDefaultFree]
 *   active/trialing --subscribe/order--> active(新档)         [applyPlan]
 *                        └─ Starter 首次（无 trial_records）→ trialing + trial_ends=+trialDays + 插 trial_records
 *   trialing --到期(@Scheduled)--> active(Free)               [TrialDowngradeJob]
 *
 * 事务边界：核心换档逻辑在包内 {@link #applyPlanInternal}（无 @Transactional 注解）；
 * 仅 public {@link #applyPlan} 保留 @Transactional（REQUIRED），专供 subscribe 独立路径
 * （订阅行更新 + trial_records 插入同生共死）。OrderService 支付事务内直调 applyPlanInternal
 * （同包直调不经 Spring 代理，无第二层事务切面）——否则 REQUIRED 参与方抛异常穿越内层
 * 代理边界会把共享事务标记 rollback-only，外层 catch DuplicateKeyException 后提交抛
 * UnexpectedRollbackException，让位删除+重查的幂等收敛失效。
 *
 * 锁序：applyPlanInternal 首步 lockForMutation(userId)（先锁 subscriptions 行再写
 * trial_records），与 OrderService.createOrder 加锁顺序一致——subscribe 与 orders 两写路径
 * 对同用户串行化，uk_trial_user_plan 冲突在正常写路径不可达（OrderService 的 catch 为纯防御）。
 */
@Service
public class SubscriptionService {

    public static final String DEFAULT_PLAN = "free";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_TRIALING = "trialing";

    private final SubscriptionMapper subscriptionMapper;
    private final PlanMapper planMapper;
    private final TrialRecordMapper trialRecordMapper;

    public SubscriptionService(SubscriptionMapper subscriptionMapper,
                               PlanMapper planMapper,
                               TrialRecordMapper trialRecordMapper) {
        this.subscriptionMapper = subscriptionMapper;
        this.planMapper = planMapper;
        this.trialRecordMapper = trialRecordMapper;
    }

    /**
     * 换档（subscribe 独立路径的事务包装）：自成一个事务（订阅行更新 + trial_records
     * 插入同生共死），核心逻辑委托 {@link #applyPlanInternal}。
     */
    @Transactional(rollbackFor = Exception.class)
    public Subscription applyPlan(String userId, String planCode) {
        return applyPlanInternal(userId, planCode);
    }

    /**
     * 换档核心逻辑（无 @Transactional，事务边界由调用方持有——subscribe 走 public
     * applyPlan 的代理，OrderService 在其支付事务内直调本方法）。
     *
     * 锁序：首步 lockForMutation 先锁该用户 subscriptions 行（无则插 free/active 占位，
     * 首次订阅用户先得到占位行、随后仍被本方法的 update 覆盖为最终态，行为不变），
     * 再判定/插入 trial_records——与 OrderService.createOrder 相同的加锁顺序，
     * 消除 subscribe vs orders 的死锁窗口，并使并发首单在计数判定前串行化。
     *
     * 套餐存在性校验（hidden 亦可订，e2e fixture 通道）→
     * 套餐含试用期且该用户无该档 trial_records → trialing + trial_ends=now+trialDays + 插记录；
     * 否则 → active（清空 trial 字段）。
     *
     * @return 生效后的订阅
     */
    Subscription applyPlanInternal(String userId, String planCode) {
        lockForMutation(userId);
        Plan plan = planMapper.getByCode(planCode);
        if (plan == null) {
            throw BusinessException.invalidPlan();
        }
        Instant now = Instant.now();
        Subscription sub = subscriptionMapper.getByUserId(userId);
        boolean created = false;
        if (sub == null) {
            sub = new Subscription();
            sub.setUserId(userId);
            sub.setCreatedAt(now);
            created = true;
        }
        sub.setPlanCode(plan.getPlanCode());
        sub.setStartedAt(now);
        sub.setExpiresAt(null);
        sub.setTrialStartedAt(null);
        sub.setTrialEndsAt(null);
        boolean firstTrial = plan.getTrialDays() > 0
                && trialRecordMapper.countByUserAndPlan(userId, plan.getPlanCode()) == 0;
        if (firstTrial) {
            sub.setStatus(STATUS_TRIALING);
            Instant endsAt = now.plusSeconds((long) plan.getTrialDays() * 24 * 3600);
            sub.setTrialStartedAt(now);
            sub.setTrialEndsAt(endsAt);
            TrialRecord record = new TrialRecord();
            record.setId(UUID.randomUUID().toString());
            record.setUserId(userId);
            record.setPlanCode(plan.getPlanCode());
            record.setStartedAt(now);
            record.setEndsAt(endsAt);
            record.setCreatedAt(now);
            trialRecordMapper.insert(record);
        } else {
            sub.setStatus(STATUS_ACTIVE);
        }
        sub.setUpdatedAt(now);
        if (created) {
            subscriptionMapper.insert(sub);
        } else {
            subscriptionMapper.update(sub);
        }
        return sub;
    }

    /** verify 激活默认绑定 Free（幂等：已有订阅不动；并发双 verify 撞 user_id 主键时静默收敛为已绑定）。 */
    public void bindDefaultFree(String userId) {
        Subscription existing = subscriptionMapper.getByUserId(userId);
        if (existing != null) {
            return;
        }
        Instant now = Instant.now();
        Subscription sub = new Subscription();
        sub.setUserId(userId);
        sub.setPlanCode(DEFAULT_PLAN);
        sub.setStatus(STATUS_ACTIVE);
        sub.setStartedAt(now);
        sub.setCreatedAt(now);
        sub.setUpdatedAt(now);
        try {
            subscriptionMapper.insert(sub);
        } catch (DataIntegrityViolationException e) {
            if (isUniqueViolation(e)) {
                // 并发 verify 的赢家已绑定（subscriptions.user_id 主键）→ 幂等返回
                return;
            }
            throw e;
        }
    }

    /**
     * 订阅写入串行化点：锁定该用户 subscriptions 行（SELECT ... FOR UPDATE）。
     * 两个写路径共用且都在 trial_records 写入前调用：OrderService 0 元下单在 paid
     * 幂等判定前排队同用户并发请求；applyPlanInternal 首步调用（锁序统一）。
     * 行不存在（存量用户 / 测试直插 seed）时先插 free/active 占位抢 user_id 主键锁；
     * 并发输家撞主键唯一冲突后重查 FOR UPDATE 收敛到赢家行。
     */
    public void lockForMutation(String userId) {
        if (subscriptionMapper.selectForUpdate(userId) != null) {
            return;
        }
        Instant now = Instant.now();
        Subscription placeholder = new Subscription();
        placeholder.setUserId(userId);
        placeholder.setPlanCode(DEFAULT_PLAN);
        placeholder.setStatus(STATUS_ACTIVE);
        placeholder.setStartedAt(now);
        placeholder.setCreatedAt(now);
        placeholder.setUpdatedAt(now);
        try {
            subscriptionMapper.insert(placeholder);
        } catch (DataIntegrityViolationException e) {
            if (!isUniqueViolation(e) || subscriptionMapper.selectForUpdate(userId) == null) {
                throw e;
            }
        }
    }

    /** 与 RegisterService/SiteService 同口径：MySQL "Duplicate entry" / H2 "Unique index or primary key violation"。 */
    private static boolean isUniqueViolation(DataIntegrityViolationException e) {
        if (e == null || e.getMessage() == null) return false;
        String m = e.getMessage();
        return m.contains("Duplicate") || m.contains("Unique index") || m.contains("primary key violation");
    }

    /** 当前订阅；无订阅回退合成 free/active（不落库，展示用）。 */
    public Subscription getOrFallback(String userId) {
        Subscription sub = subscriptionMapper.getByUserId(userId);
        if (sub != null) {
            return sub;
        }
        Instant now = Instant.now();
        Subscription fallback = new Subscription();
        fallback.setUserId(userId);
        fallback.setPlanCode(DEFAULT_PLAN);
        fallback.setStatus(STATUS_ACTIVE);
        fallback.setStartedAt(now);
        fallback.setCreatedAt(now);
        fallback.setUpdatedAt(now);
        return fallback;
    }

    /** 转 API 载荷（补套餐名）。 */
    public com.luban.backend.dto.SubscriptionResponse toResponse(Subscription sub) {
        if (sub == null) return null;
        return toResponse(sub, planMapper.getByCode(sub.getPlanCode()));
    }

    /** 转 API 载荷（复用已查出的套餐，/billing/me 单请求只查一次套餐）。 */
    public com.luban.backend.dto.SubscriptionResponse toResponse(Subscription sub, Plan plan) {
        if (sub == null) return null;
        return com.luban.backend.dto.SubscriptionResponse.fromEntity(sub, plan != null ? plan.getName() : null);
    }
}
