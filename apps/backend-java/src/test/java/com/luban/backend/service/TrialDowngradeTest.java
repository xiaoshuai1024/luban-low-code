package com.luban.backend.service;

import com.luban.backend.entity.Subscription;
import com.luban.backend.mapper.SubscriptionMapper;
import com.luban.backend.mapper.TrialRecordMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * trial 到期降级单测（plan §8.1 T-be-7，时钟注入）：
 * 扫描条件取 Clock.instant() / 到期 → active(Free) + trial_records.converted_to=free /
 * 单条失败不阻断批 / 无到期不动。
 */
@ExtendWith(MockitoExtension.class)
class TrialDowngradeTest {

    private static final Instant NOW = Instant.parse("2026-08-17T10:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Mock private SubscriptionMapper subscriptionMapper;
    @Mock private TrialRecordMapper trialRecordMapper;

    private TrialDowngradeJob job;

    @BeforeEach
    void setup() {
        PlatformTransactionManager txManager = mock(PlatformTransactionManager.class);
        org.mockito.Mockito.lenient().when(txManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        job = new TrialDowngradeJob(subscriptionMapper, trialRecordMapper,
                new TransactionTemplate(txManager), CLOCK);
    }

    private Subscription trialing(String userId, String planCode, Instant trialEndsAt) {
        Subscription sub = new Subscription();
        sub.setUserId(userId);
        sub.setPlanCode(planCode);
        sub.setStatus("trialing");
        sub.setStartedAt(trialEndsAt.minusSeconds(86400));
        sub.setTrialStartedAt(trialEndsAt.minusSeconds(86400));
        sub.setTrialEndsAt(trialEndsAt);
        return sub;
    }

    @Test
    void scanUsesInjectedClock() {
        when(subscriptionMapper.listExpiredTrialing(NOW)).thenReturn(List.of());

        job.downgradeExpiredTrials();

        verify(subscriptionMapper).listExpiredTrialing(NOW);
        verify(subscriptionMapper, never()).update(any());
    }

    @Test
    void expiredTrialDowngradedToFreeActiveWithConvertedRecord() {
        Subscription sub = trialing("user-1", "starter", NOW.minusSeconds(3600));
        when(subscriptionMapper.listExpiredTrialing(NOW)).thenReturn(List.of(sub));

        job.downgradeExpiredTrials();

        ArgumentCaptor<Subscription> captor = ArgumentCaptor.forClass(Subscription.class);
        verify(subscriptionMapper).update(captor.capture());
        Subscription updated = captor.getValue();
        assertThat(updated.getPlanCode()).isEqualTo("free");
        assertThat(updated.getStatus()).isEqualTo("active");
        assertThat(updated.getUpdatedAt()).isEqualTo(NOW);
        // trial_records 按原试用档回填（不是 free）
        verify(trialRecordMapper).markConverted("user-1", "starter", "free");
    }

    @Test
    void singleFailureDoesNotBlockRemainingBatch() {
        Subscription first = trialing("user-1", "starter", NOW.minusSeconds(3600));
        Subscription second = trialing("user-2", "starter", NOW.minusSeconds(7200));
        when(subscriptionMapper.listExpiredTrialing(NOW)).thenReturn(List.of(first, second));
        doThrow(new RuntimeException("row locked"))
                .when(subscriptionMapper).update(org.mockito.ArgumentMatchers.argThat(s -> "user-1".equals(s.getUserId())));

        job.downgradeExpiredTrials(); // user-1 失败仅告警，user-2 继续处理

        verify(subscriptionMapper).update(org.mockito.ArgumentMatchers.argThat(s -> "user-2".equals(s.getUserId())));
        verify(trialRecordMapper).markConverted("user-2", "starter", "free");
        verify(trialRecordMapper, never()).markConverted(org.mockito.ArgumentMatchers.eq("user-1"),
                any(), any());
    }

    @Test
    void noExpiredTrialsIsNoop() {
        when(subscriptionMapper.listExpiredTrialing(NOW)).thenReturn(List.of());
        job.downgradeExpiredTrials();
        verify(subscriptionMapper, never()).update(any());
        verify(trialRecordMapper, never()).markConverted(any(), any(), any());
    }
}
