package com.luban.backend.service;

import com.luban.backend.entity.Plan;
import com.luban.backend.entity.Subscription;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.PlanMapper;
import com.luban.backend.mapper.SubscriptionMapper;
import com.luban.backend.mapper.UsageCounterMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * 配额服务（T-be-5）：先查限后累加（拦截在累加前，宁少计不超放）。
 *
 *  - 累加：INSERT ... ON DUPLICATE KEY UPDATE count = count + 1（MySQL 原子，uk_usage 唯一键）；
 *  - quota = 0 表示不限（quota_visits 本期全 0，见 plan §10.2），仍累加计数供用量展示；
 *  - 超限：429 QUOTA_EXCEEDED，details {metric, limit, used}；
 *  - 无订阅用户回退 free 档配额（防御：verify 激活必绑 Free，正常均有订阅）。
 */
@Service
public class QuotaService {

    private static final Logger log = LoggerFactory.getLogger(QuotaService.class);
    private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final String DEFAULT_PLAN = "free";

    public static final String METRIC_LEADS = "leads";
    public static final String METRIC_PAGES = "pages";
    public static final String METRIC_VISITS = "visits";

    private final UsageCounterMapper usageCounterMapper;
    private final SubscriptionMapper subscriptionMapper;
    private final PlanMapper planMapper;

    public QuotaService(UsageCounterMapper usageCounterMapper,
                        SubscriptionMapper subscriptionMapper,
                        PlanMapper planMapper) {
        this.usageCounterMapper = usageCounterMapper;
        this.subscriptionMapper = subscriptionMapper;
        this.planMapper = planMapper;
    }

    /** 前置校验 + 计数（业务写入口调用：PageService.create / LeadService.submit）。 */
    public void checkAndIncrement(String userId, String metric) {
        String period = currentPeriod();
        int quota = quotaOf(userId, metric);
        if (quota > 0) {
            long used = getCount(userId, period, metric);
            if (used >= quota) {
                throw BusinessException.quotaExceeded(metric, quota, used);
            }
        }
        increment(userId, period, metric);
    }

    /** 当前周期用量（/billing/me、/billing/usage 展示）。 */
    public long getCount(String userId, String period, String metric) {
        Long v = usageCounterMapper.getCount(userId, period, metric);
        return v != null ? v : 0L;
    }

    /** 原子累加（幂等重试不回退：宁少计不超放方向的安全侧）。 */
    public void increment(String userId, String period, String metric) {
        usageCounterMapper.increment(UUID.randomUUID().toString(), userId, period, metric, java.time.Instant.now());
    }

    /** 用户当前订阅档的某指标配额；无订阅回退 free 档；未知套餐/指标回退 0=不限。 */
    public int quotaOf(String userId, String metric) {
        Subscription sub = subscriptionMapper.getByUserId(userId);
        String planCode = sub != null ? sub.getPlanCode() : DEFAULT_PLAN;
        Plan plan = planMapper.getByCode(planCode);
        if (plan == null) {
            log.warn("quota lookup: plan '{}' missing for user {}, treating as unlimited", planCode, userId);
            return 0;
        }
        return switch (metric != null ? metric : "") {
            case METRIC_LEADS -> plan.getQuotaLeads();
            case METRIC_PAGES -> plan.getQuotaPages();
            case METRIC_VISITS -> plan.getQuotaVisits();
            default -> 0;
        };
    }

    /** 周期格式 "yyyy-MM"（UTC）。 */
    public static String currentPeriod() {
        return PERIOD_FORMAT.format(ZonedDateTime.now(ZoneOffset.UTC));
    }
}
