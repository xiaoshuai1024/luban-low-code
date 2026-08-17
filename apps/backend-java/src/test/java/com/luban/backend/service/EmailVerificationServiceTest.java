package com.luban.backend.service;

import com.luban.backend.entity.EmailVerification;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.EmailVerificationMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 验证码生命周期单测（plan §8.1，穷举 §3.2 生命周期边）：
 * 创建（TTL 10min + SHA-256 hash）/ verify 失败 attempts+1（≥5 作废）/ 过期 / 成功返回未消费实体 /
 * 重发 60s 冷却 + 每邮箱日限 10。
 */
@ExtendWith(MockitoExtension.class)
class EmailVerificationServiceTest {

    private static final String EMAIL = "alice@example.com";
    private static final String CODE = "123456";

    @Mock private EmailVerificationMapper mapper;

    private EmailVerificationService service;

    @BeforeEach
    void setup() {
        service = new EmailVerificationService(mapper);
    }

    private EmailVerification row(int attempts, Instant expiresAt, Instant consumedAt, Instant createdAt) {
        EmailVerification ev = new EmailVerification();
        ev.setId("ev-1");
        ev.setEmail(EMAIL);
        ev.setCodeHash(EmailVerificationService.sha256Hex(CODE));
        ev.setAttempts(attempts);
        ev.setExpiresAt(expiresAt);
        ev.setConsumedAt(consumedAt);
        ev.setCreatedAt(createdAt);
        return ev;
    }

    // === 创建 ===

    @Test
    void issueStoresSha256HashWithTtlAndZeroAttempts() {
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(null);
        when(mapper.countCreatedSince(eq(EMAIL), any())).thenReturn(0L);

        EmailVerificationService.IssuedCode issued = service.issue(EMAIL);

        assertThat(issued.code()).matches("^[0-9]{6}$");
        ArgumentCaptor<EmailVerification> captor = ArgumentCaptor.forClass(EmailVerification.class);
        verify(mapper).insert(captor.capture());
        EmailVerification stored = captor.getValue();
        // 明文码不落库：库存为 SHA-256 hex
        assertThat(stored.getCodeHash()).isEqualTo(EmailVerificationService.sha256Hex(issued.code()));
        assertThat(stored.getCodeHash()).hasSize(64);
        assertThat(stored.getAttempts()).isZero();
        assertThat(stored.getConsumedAt()).isNull();
        assertThat(stored.getExpiresAt()).isAfter(Instant.now().plusSeconds(EmailVerificationService.CODE_TTL_SECONDS - 30));
        assertThat(stored.getExpiresAt()).isBefore(Instant.now().plusSeconds(EmailVerificationService.CODE_TTL_SECONDS + 30));
    }

    @Test
    void issueWithinCooldownThrows() {
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(row(0, Instant.now().plusSeconds(600), null,
                Instant.now().minusSeconds(30)));

        assertThatThrownBy(() -> service.issue(EMAIL))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> { assertThat(e.getCode()).isEqualTo("VERIFY_RESEND_COOLDOWN");
                               assertThat(e.getHttpStatus().value()).isEqualTo(429); });
        verify(mapper, never()).insert(any());
    }

    @Test
    void issueAtDailyLimitThrows() {
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(row(0, Instant.now().plusSeconds(600), null,
                Instant.now().minusSeconds(120)));
        when(mapper.countCreatedSince(eq(EMAIL), any())).thenReturn(10L);

        assertThatThrownBy(() -> service.issue(EMAIL))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> { assertThat(e.getCode()).isEqualTo("VERIFY_RESEND_DAILY_LIMIT");
                               assertThat(e.getHttpStatus().value()).isEqualTo(429); });
        verify(mapper, never()).insert(any());
    }

    // === verify ===

    @Test
    void verifyNoRecordThrowsInvalid() {
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(null);
        assertThatCodeInvalid(service, CODE, 5);
    }

    @Test
    void verifyConsumedThrowsInvalid() {
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(row(0, Instant.now().plusSeconds(600),
                Instant.now().minusSeconds(60), Instant.now()));
        assertThatCodeInvalid(service, CODE, 5);
    }

    @Test
    void verifyBlankCodeThrowsInvalid() {
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(row(0, Instant.now().plusSeconds(600), null, Instant.now()));
        assertThatCodeInvalid(service, "", 5);
    }

    @Test
    void verifyExpiredThrowsExpired() {
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(row(0, Instant.now().minusSeconds(1), null, Instant.now()));
        assertThatThrownBy(() -> service.verify(EMAIL, CODE))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo("VERIFY_CODE_EXPIRED"));
    }

    @Test
    void verifyWrongCodeIncrementsAttemptsAndReportsRemaining() {
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(row(2, Instant.now().plusSeconds(600), null, Instant.now()));
        when(mapper.incrementAttempts("ev-1")).thenReturn(1);

        assertThatCodeInvalid(service, "999999", 2); // 5 - (2+1)

        // 原子自增（SQL 守卫 attempts<5），不再「读-改-写」回传绝对值
        verify(mapper).incrementAttempts("ev-1");
    }

    @Test
    void verifyFifthFailureExceedsAttempts() {
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(row(4, Instant.now().plusSeconds(600), null, Instant.now()));
        when(mapper.incrementAttempts("ev-1")).thenReturn(1);

        assertThatThrownBy(() -> service.verify(EMAIL, "999999"))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo("VERIFY_ATTEMPTS_EXCEEDED"));
        verify(mapper).incrementAttempts("ev-1");
    }

    /** 并发竞态：自增未生效（另一请求已把 attempts 计满）→ 回读最新行判 EXCEEDED。 */
    @Test
    void verifyWrongCodeWhenIncrementLosesRaceReReadsAndExceeds() {
        when(mapper.findLatestByEmail(EMAIL))
                .thenReturn(row(4, Instant.now().plusSeconds(600), null, Instant.now()))
                .thenReturn(row(5, Instant.now().plusSeconds(600), null, Instant.now()));
        when(mapper.incrementAttempts("ev-1")).thenReturn(0);

        assertThatThrownBy(() -> service.verify(EMAIL, "999999"))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo("VERIFY_ATTEMPTS_EXCEEDED"));
        verify(mapper).incrementAttempts("ev-1");
    }

    @Test
    void verifyAtAttemptLimitRejectsEvenCorrectCode() {
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(row(5, Instant.now().plusSeconds(600), null, Instant.now()));
        assertThatThrownBy(() -> service.verify(EMAIL, CODE))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo("VERIFY_ATTEMPTS_EXCEEDED"));
        verify(mapper, never()).incrementAttempts(any());
    }

    @Test
    void verifyCorrectCodeReturnsUnconsumedEntity() {
        EmailVerification latest = row(0, Instant.now().plusSeconds(600), null, Instant.now());
        when(mapper.findLatestByEmail(EMAIL)).thenReturn(latest);

        EmailVerification result = service.verify(EMAIL, CODE);

        assertThat(result).isSameAs(latest);
        verify(mapper, never()).incrementAttempts(any());
        verify(mapper, never()).markConsumed(any(), any()); // 消费在激活事务内完成
    }

    @Test
    void markConsumedDelegatesWithNow() {
        service.markConsumed("ev-1");
        verify(mapper).markConsumed(eq("ev-1"), any());
    }

    // === 发信失败回滚（冷却/日限只对成功发信计数） ===

    @Test
    void discardIssuedDeletesRowById() {
        service.discardIssued("ev-1");
        verify(mapper).deleteById("ev-1");
    }

    @Test
    void discardIssuedNullIsNoop() {
        service.discardIssued(null);
        verify(mapper, never()).deleteById(any());
    }

    private void assertThatCodeInvalid(EmailVerificationService service, String code, int expectedRemaining) {
        assertThatThrownBy(() -> service.verify(EMAIL, code))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("VERIFY_CODE_INVALID");
                    assertThat(e.getHttpStatus().value()).isEqualTo(400);
                    assertThat(e.getDetails())
                            .isEqualTo(java.util.Map.of("remainingAttempts", expectedRemaining));
                });
    }
}
