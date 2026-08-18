package com.luban.backend.service;

import com.luban.backend.entity.EmailVerification;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.EmailVerificationMapper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

/**
 * 邮箱验证码生命周期（plan §3.2/§3.4）：
 *
 *  - 创建：6 位数字码，库存 SHA-256 hex（code_hash），TTL 10min，attempts=0；
 *  - verify 失败：attempts+1，≥5 作废（VERIFY_ATTEMPTS_EXCEEDED）；过期 → VERIFY_CODE_EXPIRED；
 *  - verify 成功：仅校验通过即返回实体，消费（markConsumed）由 RegisterService 的
 *    激活事务完成（user→active + 默认订阅 + 消费码单事务，失败整体回滚）；
 *  - 重发：同 email 60s 冷却（VERIFY_RESEND_COOLDOWN）+ 每邮箱日限 10
 *    （VERIFY_RESEND_DAILY_LIMIT，UTC 日界），旧码因「仅最新行参与校验」自然作废。
 *
 * 冷却/日限实现选型：email_verifications 表 DB 计数（created_at 维度），不引入 Redis——
 * 测试环境 Redis 指向不存在端口（懒连接不校验），DB 方案在单测/契约/生产三态行为一致。
 */
@Service
public class EmailVerificationService {

    static final int CODE_TTL_MINUTES = 10;
    static final int CODE_TTL_SECONDS = CODE_TTL_MINUTES * 60;
    static final int MAX_ATTEMPTS = EmailVerificationMapper.MAX_ATTEMPTS;
    static final int RESEND_COOLDOWN_SECONDS = 60;
    static final int DAILY_LIMIT = 10;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final EmailVerificationMapper verificationMapper;
    private final Clock clock;

    /** Clock 注入（对齐 TrialDowngradeJob / SchedulingConfig 先例）：时间源可测。 */
    public EmailVerificationService(EmailVerificationMapper verificationMapper, Clock clock) {
        this.verificationMapper = verificationMapper;
        this.clock = clock;
    }

    /** 发码结果：实体（含 id 供消费）+ 明文码（仅内存/邮件正文，不落库不落日志）。 */
    public record IssuedCode(EmailVerification verification, String code) {}

    /** 重发/首发的统一入口：冷却与日限校验 → 插入新行（旧行自然作废，TTL 重置）。 */
    public IssuedCode issue(String email) {
        Instant now = clock.instant();
        EmailVerification latest = verificationMapper.findLatestByEmail(email);
        if (latest != null && latest.getCreatedAt() != null
                && latest.getCreatedAt().isAfter(now.minusSeconds(RESEND_COOLDOWN_SECONDS))) {
            throw BusinessException.verifyResendCooldown();
        }
        long todayCount = verificationMapper.countCreatedSince(email, startOfUtcDay(now));
        if (todayCount >= DAILY_LIMIT) {
            throw BusinessException.verifyResendDailyLimit();
        }
        String code = String.format(Locale.ROOT, "%06d", RANDOM.nextInt(1_000_000));
        EmailVerification ev = new EmailVerification();
        ev.setId(UUID.randomUUID().toString());
        ev.setEmail(email);
        ev.setCodeHash(sha256Hex(code));
        ev.setAttempts(0);
        ev.setExpiresAt(now.plusSeconds(CODE_TTL_SECONDS));
        ev.setCreatedAt(now);
        verificationMapper.insert(ev);
        return new IssuedCode(ev, code);
    }

    /**
     * 校验（含失败计数，独立于激活事务——失败次数不因后续业务回滚而丢失）。
     * 任何"无记录/已消费/空码"统一回 VERIFY_CODE_INVALID（防枚举）。
     *
     * @return 校验通过的验证码实体（未消费；由激活事务 markConsumed）
     */
    public EmailVerification verify(String email, String code) {
        EmailVerification latest = verificationMapper.findLatestByEmail(email);
        if (latest == null || latest.getConsumedAt() != null || code == null || code.isBlank()) {
            throw BusinessException.verifyCodeInvalid(MAX_ATTEMPTS);
        }
        if (latest.getAttempts() >= MAX_ATTEMPTS) {
            throw BusinessException.verifyAttemptsExceeded();
        }
        if (latest.getExpiresAt() != null && latest.getExpiresAt().isBefore(clock.instant())) {
            throw BusinessException.verifyCodeExpired();
        }
        if (!hashEquals(latest.getCodeHash(), code)) {
            // 原子自增（SQL 守卫 attempts<MAX）：并发错码只成功计数一次
            int updated = verificationMapper.incrementAttempts(latest.getId());
            int attempts = updated == 1 ? latest.getAttempts() + 1 : attemptsAfterReRead(email);
            if (attempts >= MAX_ATTEMPTS) {
                throw BusinessException.verifyAttemptsExceeded();
            }
            throw BusinessException.verifyCodeInvalid(MAX_ATTEMPTS - attempts);
        }
        return latest;
    }

    /** 自增未生效（并发已计满/行被替换）→ 回读最新行取真实 attempts；行不存在按已计满收敛。 */
    private int attemptsAfterReRead(String email) {
        EmailVerification fresh = verificationMapper.findLatestByEmail(email);
        return fresh != null ? fresh.getAttempts() : MAX_ATTEMPTS;
    }

    /** 消费验证码（激活事务内调用；重复消费被 WHERE consumed_at IS NULL 天然幂等）。 */
    public void markConsumed(String verificationId) {
        if (verificationId != null) {
            verificationMapper.markConsumed(verificationId, clock.instant());
        }
    }

    /** 发信失败回滚验证码行：冷却/日限只对成功发信计数（RegisterService 调用）。 */
    public void discardIssued(String verificationId) {
        if (verificationId != null) {
            verificationMapper.deleteById(verificationId);
        }
    }

    static String sha256Hex(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /** 常时比较（对齐 AuthFilter 的 MessageDigest.isEqual 用法），杜绝逐字节短路时序泄漏。 */
    private static boolean hashEquals(String expectedHex, String rawCode) {
        if (expectedHex == null || expectedHex.isEmpty()) return false;
        return MessageDigest.isEqual(
                expectedHex.getBytes(StandardCharsets.UTF_8),
                sha256Hex(rawCode).getBytes(StandardCharsets.UTF_8));
    }

    private static Instant startOfUtcDay(Instant now) {
        return now.atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
    }
}
