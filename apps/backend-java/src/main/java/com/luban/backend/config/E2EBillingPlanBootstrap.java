package com.luban.backend.config;

import com.luban.backend.entity.Plan;
import com.luban.backend.entity.User;
import com.luban.backend.mapper.PlanMapper;
import com.luban.backend.mapper.UserMapper;
import com.luban.backend.service.SubscriptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * E2E quota 拦截 fixture（plan 裁定 #5 方案 A）：env 门控幂等插入 e2e-tiny 套餐
 * （hidden + quota_leads=1 + quota_pages=1），供 e2e/flows/quota-enforcement.spec.ts
 * 直接 subscribe/order 触发 429 QUOTA_EXCEEDED（visible 过滤不影响订阅校验）。
 *
 * 同时把 e2e 主账号（E2E_BOOTSTRAP_ACCOUNT）订阅到 e2e-pro（quota 全 0=不限）：
 * e2e 套件数十个 spec 共用同一账号建站/建页/提交，Free 档 quota_pages=3 会中途 429
 * 导致与 quota 无关的 spec 连带失败；quota-enforcement.spec 自行注册独立用户订 e2e-tiny，
 * 不受影响。
 *
 * 与 E2EAccountBootstrap 同型：
 *  - 仅当 E2E_BILLING_BOOTSTRAP=true 启用（生产不配置即完全不生效，G2 审计项保持缺席）；
 *  - 已存在则跳过（幂等，跨 e2e 数据卷持久保留时安全）；
 *  - 不入生产 Flyway 迁移。
 */
@Order(2)
@Component
public class E2EBillingPlanBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(E2EBillingPlanBootstrap.class);
    static final String E2E_PLAN_CODE = "e2e-tiny";
    static final String E2E_PRO_PLAN_CODE = "e2e-pro";

    private final PlanMapper planMapper;
    private final UserMapper userMapper;
    private final SubscriptionService subscriptionService;
    private final boolean enabled;
    private final String account;

    public E2EBillingPlanBootstrap(PlanMapper planMapper,
                                   UserMapper userMapper,
                                   SubscriptionService subscriptionService,
                                   @Value("${E2E_BILLING_BOOTSTRAP:false}") boolean enabled,
                                   @Value("${E2E_BOOTSTRAP_ACCOUNT:}") String account) {
        this.planMapper = planMapper;
        this.userMapper = userMapper;
        this.subscriptionService = subscriptionService;
        this.enabled = enabled;
        this.account = account == null ? "" : account.trim();
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return; // 生产/默认路径：完全不生效
        }
        ensurePlan(E2E_PLAN_CODE, "E2E Tiny (fixture)", 1, 1);
        ensurePlan(E2E_PRO_PLAN_CODE, "E2E Pro (unlimited fixture)", 0, 0);
        subscribeE2EAccountToPro();
    }

    private void ensurePlan(String code, String name, int quotaLeads, int quotaPages) {
        if (planMapper.getByCode(code) != null) {
            return; // 幂等
        }
        Plan plan = new Plan();
        plan.setPlanCode(code);
        plan.setName(name);
        plan.setStatus("hidden");
        plan.setPriceMonthly(0);
        plan.setQuotaLeads(quotaLeads);
        plan.setQuotaPages(quotaPages);
        plan.setQuotaVisits(0);
        plan.setTrialDays(0);
        plan.setSortOrder(99);
        planMapper.insert(plan);
        log.info("e2e billing plan '{}' created (quota_leads={}, quota_pages={})", code, quotaLeads, quotaPages);
    }

    /** e2e 主账号订阅 e2e-pro（配额 0=不限）；账号未配置或不存在则跳过。 */
    private void subscribeE2EAccountToPro() {
        if (account.isEmpty()) {
            return;
        }
        User user = userMapper.findByUsername(account);
        if (user == null) {
            log.info("e2e account '{}' not found yet, skip pro subscribe", account);
            return;
        }
        subscriptionService.applyPlan(user.getId(), E2E_PRO_PLAN_CODE);
        log.info("e2e account '{}' subscribed to '{}'", account, E2E_PRO_PLAN_CODE);
    }
}
