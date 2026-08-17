package com.luban.backend.service;

import com.luban.backend.entity.Plan;
import com.luban.backend.entity.Subscription;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.PlanMapper;
import com.luban.backend.mapper.SubscriptionMapper;
import com.luban.backend.mapper.UsageCounterMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 配额单测（plan §8.1 T-be-5）：先查限后累加、quota=0 不限、超限 429 details{metric,limit,used}、
 * 无订阅回退 free 档、周期格式 yyyy-MM（UTC）。
 */
@ExtendWith(MockitoExtension.class)
class QuotaServiceTest {

    private static final String USER_ID = "user-quota";
    private static final String PERIOD = "2026-08";

    @Mock private UsageCounterMapper usageCounterMapper;
    @Mock private SubscriptionMapper subscriptionMapper;
    @Mock private PlanMapper planMapper;

    private QuotaService service;

    @BeforeEach
    void setup() {
        service = new QuotaService(usageCounterMapper, subscriptionMapper, planMapper);
    }

    private void seedPlan(String planCode, int quotaLeads, int quotaPages, int quotaVisits) {
        Plan p = new Plan();
        p.setPlanCode(planCode);
        p.setQuotaLeads(quotaLeads);
        p.setQuotaPages(quotaPages);
        p.setQuotaVisits(quotaVisits);
        lenient().when(planMapper.getByCode(planCode)).thenReturn(p);
    }

    private void seedSubscription(String planCode) {
        Subscription sub = new Subscription();
        sub.setUserId(USER_ID);
        sub.setPlanCode(planCode);
        lenient().when(subscriptionMapper.getByUserId(USER_ID)).thenReturn(sub);
    }

    @Test
    void zeroQuotaMeansUnlimited() {
        seedSubscription("growth");
        seedPlan("growth", 10000, 50, 0); // quota_visits=0 → 不查限直接累加

        assertThatCode(() -> service.checkAndIncrement(USER_ID, "visits")).doesNotThrowAnyException();
        verify(usageCounterMapper).increment(anyString(), eq(USER_ID), eq(PERIOD), eq("visits"), any());
    }

    @Test
    void overQuotaThrows429WithDetailsAndSkipsIncrement() {
        seedSubscription("e2e-tiny");
        seedPlan("e2e-tiny", 1, 1, 0);
        when(usageCounterMapper.getCount(USER_ID, PERIOD, "pages")).thenReturn(1L);

        assertThatThrownBy(() -> service.checkAndIncrement(USER_ID, "pages"))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("QUOTA_EXCEEDED");
                    assertThat(e.getHttpStatus().value()).isEqualTo(429);
                    assertThat(e.getDetails()).isEqualTo(Map.of("metric", "pages", "limit", 1L, "used", 1L));
                });
        verify(usageCounterMapper, never()).increment(anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void underQuotaIncrements() {
        seedSubscription("free");
        seedPlan("free", 100, 3, 0);
        when(usageCounterMapper.getCount(USER_ID, PERIOD, "leads")).thenReturn(99L);

        service.checkAndIncrement(USER_ID, "leads");

        verify(usageCounterMapper).increment(anyString(), eq(USER_ID), eq(PERIOD), eq("leads"), any());
    }

    @Test
    void noSubscriptionFallsBackToFreeQuota() {
        when(subscriptionMapper.getByUserId(USER_ID)).thenReturn(null);
        seedPlan("free", 100, 3, 0);
        when(usageCounterMapper.getCount(USER_ID, PERIOD, "pages")).thenReturn(3L);

        assertThatThrownBy(() -> service.checkAndIncrement(USER_ID, "pages"))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo("QUOTA_EXCEEDED"));
    }

    @Test
    void missingPlanTreatedAsUnlimited() {
        seedSubscription("ghost-plan");
        when(planMapper.getByCode("ghost-plan")).thenReturn(null);

        assertThatCode(() -> service.checkAndIncrement(USER_ID, "leads")).doesNotThrowAnyException();
        verify(usageCounterMapper).increment(anyString(), eq(USER_ID), anyString(), eq("leads"), any());
    }

    @Test
    void quotaOfResolvesMetricPerPlan() {
        seedSubscription("starter");
        seedPlan("starter", 1000, 10, 0);

        assertThat(service.quotaOf(USER_ID, "leads")).isEqualTo(1000);
        assertThat(service.quotaOf(USER_ID, "pages")).isEqualTo(10);
        assertThat(service.quotaOf(USER_ID, "visits")).isEqualTo(0);
    }

    @Test
    void currentPeriodIsYearMonthUtc() {
        assertThat(QuotaService.currentPeriod()).matches("^\\d{4}-(0[1-9]|1[0-2])$");
    }

    @Test
    void getCountDefaultsToZero() {
        when(usageCounterMapper.getCount(USER_ID, PERIOD, "leads")).thenReturn(null);
        assertThat(service.getCount(USER_ID, PERIOD, "leads")).isZero();
    }
}
