package com.luban.backend.service;

import com.luban.backend.entity.Subscription;
import com.luban.backend.mapper.SubscriptionMapper;
import com.luban.backend.mapper.TrialRecordMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

/**
 * 试用到期降级（T-be-7，plan §3.2/§3.3）：
 *
 *   每小时扫 status=trialing 且 trial_ends_at < now → 守卫式 UPDATE 降 active(Free)
 *   （顺带清空 trial_started_at/trial_ends_at 残留字段，数据保留）
 *   + 影响行数=1 才回填 trial_records.converted_to='free'
 *
 * 单条独立事务（TransactionTemplate 逐条包裹）：某条失败仅记录告警不阻断批
 * （部分失败可由下轮扫描自愈——降级条件仍在）。守卫条件（仍 trialing 且已到期）
 * 使并发处理 / 状态已变时 0 行命中、不误降级、不重复回填。
 */
@Component
public class TrialDowngradeJob {

    private static final Logger log = LoggerFactory.getLogger(TrialDowngradeJob.class);
    static final String DOWNGRADE_PLAN = "free";

    private final SubscriptionMapper subscriptionMapper;
    private final TrialRecordMapper trialRecordMapper;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;

    public TrialDowngradeJob(SubscriptionMapper subscriptionMapper,
                             TrialRecordMapper trialRecordMapper,
                             TransactionTemplate transactionTemplate,
                             Clock clock) {
        this.subscriptionMapper = subscriptionMapper;
        this.trialRecordMapper = trialRecordMapper;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 * * * *") // 每小时整点
    public void downgradeExpiredTrials() {
        Instant now = clock.instant();
        List<Subscription> expired = subscriptionMapper.listExpiredTrialing(now);
        if (expired.isEmpty()) {
            return;
        }
        log.info("trial downgrade: {} expired trialing subscription(s) at {}", expired.size(), now);
        for (Subscription sub : expired) {
            try {
                downgradeOne(sub, now);
            } catch (Exception e) {
                // 单条独立事务：失败不阻断批，下轮自愈（异常对象作最后一个参数，SLF4J 打全堆栈）
                log.warn("trial downgrade failed for user {}", sub.getUserId(), e);
            }
        }
    }

    /**
     * 单条独立事务：守卫式降级 UPDATE（仅 status=trialing 且已到期才落 free/active，
     * 清 trial 残留字段）→ 影响行数=1 才回填 trial_records.converted_to。
     * trialPlan 须先取原档（回填 trial_records 用）。
     */
    void downgradeOne(Subscription sub, Instant now) {
        String trialPlan = sub.getPlanCode();
        transactionTemplate.executeWithoutResult(tx -> {
            int updated = subscriptionMapper.guardDowngradeToFree(sub.getUserId(), now);
            if (updated == 1) {
                trialRecordMapper.markConverted(sub.getUserId(), trialPlan, DOWNGRADE_PLAN);
            } else {
                log.debug("trial downgrade skipped for user {}: guard matched 0 rows (already downgraded or state changed)",
                        sub.getUserId());
            }
        });
    }
}
