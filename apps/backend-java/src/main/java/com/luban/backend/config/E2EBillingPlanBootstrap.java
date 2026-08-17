package com.luban.backend.config;

import com.luban.backend.entity.Plan;
import com.luban.backend.mapper.PlanMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * E2E quota 拦截 fixture（plan 裁定 #5 方案 A）：env 门控幂等插入 e2e-tiny 套餐
 * （hidden + quota_leads=1 + quota_pages=1），供 e2e/flows/quota-enforcement.spec.ts
 * 直接 subscribe/order 触发 429 QUOTA_EXCEEDED（visible 过滤不影响订阅校验）。
 *
 * 与 E2EAccountBootstrap 同型：
 *  - 仅当 E2E_BILLING_BOOTSTRAP=true 启用（生产不配置即完全不生效，G2 审计项保持缺席）；
 *  - 已存在则跳过（幂等，跨 e2e 数据卷持久保留时安全）；
 *  - 不入生产 Flyway 迁移。
 */
@Component
public class E2EBillingPlanBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(E2EBillingPlanBootstrap.class);
    static final String E2E_PLAN_CODE = "e2e-tiny";

    private final PlanMapper planMapper;
    private final boolean enabled;

    public E2EBillingPlanBootstrap(PlanMapper planMapper,
                                   @Value("${E2E_BILLING_BOOTSTRAP:false}") boolean enabled) {
        this.planMapper = planMapper;
        this.enabled = enabled;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return; // 生产/默认路径：完全不生效
        }
        if (planMapper.getByCode(E2E_PLAN_CODE) != null) {
            log.info("e2e billing plan '{}' already exists, skip", E2E_PLAN_CODE);
            return;
        }
        Plan plan = new Plan();
        plan.setPlanCode(E2E_PLAN_CODE);
        plan.setName("E2E Tiny (fixture)");
        plan.setStatus("hidden");
        plan.setPriceMonthly(0);
        plan.setQuotaLeads(1);
        plan.setQuotaPages(1);
        plan.setQuotaVisits(0);
        plan.setTrialDays(0);
        plan.setSortOrder(99);
        planMapper.insert(plan);
        log.info("e2e billing plan '{}' created (hidden, quota_leads=1, quota_pages=1)", E2E_PLAN_CODE);
    }
}
