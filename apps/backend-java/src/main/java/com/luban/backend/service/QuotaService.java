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

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * 配额服务（T-be-5）：原子条件累加（判限与计数同一条 UPDATE，无先查后加的超放窗口）。
 *
 *  - 占位：INSERT IGNORE 预落 count=0 行（撞 uk_usage 静默跳过，MySQL / H2 MODE=MySQL）；
 *  - 累加：quota>0 → UPDATE ... SET count=count+1 WHERE ... AND count < quota（0 行=超限）；
 *  - quota = 0 表示不限（quota_visits 本期全 0，见 plan §10.2）→ 无条件累加供用量展示；
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

    /**
     * 原子条件累加（业务写入口调用：PageService.create / LeadService.submit）：
     * 占位 → quota>0 时条件累加（count<quota 才 +1，0 行=超限抛 429）；quota=0 不限直接累加。
     */
    public void checkAndIncrement(String userId, String metric) {
        String period = currentPeriod();
        int quota = quotaOf(userId, metric);
        Instant now = Instant.now();
        usageCounterMapper.insertPlaceholder(UUID.randomUUID().toString(), userId, period, metric, now);
        if (quota > 0) {
            int updated = usageCounterMapper.incrementIfBelowQuota(userId, period, metric, quota, now);
            if (updated == 0) {
                throw BusinessException.quotaExceeded(metric, quota, getCount(userId, period, metric));
            }
        } else {
            usageCounterMapper.incrementUnconditional(userId, period, metric, now);
        }
    }

    /** 当前周期用量（/billing/me、/billing/usage 展示）。 */
    public long getCount(String userId, String period, String metric) {
        Long v = usageCounterMapper.getCount(userId, period, metric);
        return v != null ? v : 0L;
    }

    /** 无条件累加（quota=0 不限路径；已保证占位行存在）。 */
    public void increment(String userId, String period, String metric) {
        Instant now = Instant.now();
        usageCounterMapper.insertPlaceholder(UUID.randomUUID().toString(), userId, period, metric, now);
        usageCounterMapper.incrementUnconditional(userId, period, metric, now);
    }

    /** 回退一次累加（count > 0 守卫防负）：LeadService 唯一键冲突收敛路径未产生新 lead 时回退 leads 计数。 */
    public void decrement(String userId, String metric) {
        usageCounterMapper.decrement(userId, currentPeriod(), metric, java.time.Instant.now());
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
        return quotaOf(sub, plan, metric);
    }

    /** 已查出订阅/套餐的配额读取（/billing/me 复用：单请求只查一次订阅+套餐）；口径同 {@link #quotaOf(String, String)}。 */
    public int quotaOf(Subscription sub, Plan plan, String metric) {
        if (plan == null) {
            String planCode = sub != null ? sub.getPlanCode() : DEFAULT_PLAN;
            log.warn("quota lookup: plan '{}' missing, treating as unlimited", planCode);
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
