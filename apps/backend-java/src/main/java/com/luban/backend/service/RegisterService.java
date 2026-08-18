package com.luban.backend.service;

import com.luban.backend.dto.RegisterResendResponse;
import com.luban.backend.dto.RegisterResponse;
import com.luban.backend.dto.RegisterVerifyResponse;
import com.luban.backend.dto.UserResponse;
import com.luban.backend.entity.EmailVerification;
import com.luban.backend.entity.User;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 注册编排（T-be-2）：
 *  - register：服务层白名单校验 → users INSERT(status=pending_verification) → 发码；
 *  - activateVerifiedUser（verify 第二步，事务）：user→active + email_verified_at +
 *    默认订阅 Free + 消费验证码，单事务失败整体回滚（plan §3.3）；
 *  - resend：仅对 status=pending_verification 的用户发码（防枚举：未知/active/disabled 一律 200 掩码、不发码）。
 *
 * verify 拆两步的原因：失败计数（attempts+1）必须独立于激活事务提交，
 * 否则验证失败抛异常会连失败计数一起回滚（见 EmailVerificationService.verify javadoc）。
 */
@Service
public class RegisterService {

    private static final Logger log = LoggerFactory.getLogger(RegisterService.class);
    private static final String USERNAME_PATTERN = "[a-z0-9_-]{3,32}";

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationService emailVerificationService;
    private final MailService mailService;
    private final SubscriptionService subscriptionService;

    public RegisterService(UserMapper userMapper,
                           PasswordEncoder passwordEncoder,
                           EmailVerificationService emailVerificationService,
                           MailService mailService,
                           SubscriptionService subscriptionService) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
        this.emailVerificationService = emailVerificationService;
        this.mailService = mailService;
        this.subscriptionService = subscriptionService;
    }

    public RegisterResponse register(String username, String email, String password) {
        if (username == null || !username.matches(USERNAME_PATTERN)) {
            throw BusinessException.invalidArgument("username: 3-32 位小写字母/数字/_/-");
        }
        if (!isStrongPassword(password)) {
            throw BusinessException.weakPassword();
        }
        if (userMapper.findByUsername(username) != null) {
            throw BusinessException.usernameTaken();
        }
        if (userMapper.findByEmail(email) != null) {
            throw BusinessException.emailTaken();
        }
        User u = new User();
        u.setId(UUID.randomUUID().toString());
        u.setUsername(username);
        u.setName(username);
        u.setRole("user");
        u.setStatus("pending_verification");
        u.setEmail(email);
        u.setPassword(passwordEncoder.encode(password));
        Instant now = Instant.now();
        u.setCreatedAt(now);
        u.setUpdatedAt(now);
        try {
            userMapper.insert(u);
        } catch (DataIntegrityViolationException e) {
            if (isUniqueViolation(e)) {
                // 并发注册竞态：撞 uk_users_username / uk_users_email（唯一键区分二者）
                throw userMapper.findByUsername(username) != null
                        ? BusinessException.usernameTaken()
                        : BusinessException.emailTaken();
            }
            throw e;
        }
        EmailVerificationService.IssuedCode issued = emailVerificationService.issue(email);
        try {
            // fail-closed：SMTP 未配置且非 dev-echo → 503 EMAIL_SERVICE_UNAVAILABLE（用户行保留 pending，可经 resend 恢复）
            mailService.sendVerificationCode(email, issued.code(), EmailVerificationService.CODE_TTL_MINUTES);
        } catch (RuntimeException e) {
            // 发信失败不烧额度：回滚验证码行，冷却/日限只对成功发信计数
            emailVerificationService.discardIssued(issued.verification().getId());
            throw e;
        }
        String devCode = mailService.devEchoEnabled() ? issued.code() : null;
        return new RegisterResponse(username, MailService.maskEmail(email), devCode);
    }

    /**
     * verify 激活事务：user→active + email_verified_at + 默认订阅 Free + 消费验证码。
     * verificationId 由 controller 先经 EmailVerificationService.verify 校验获得（失败计数已落库）。
     */
    @Transactional(rollbackFor = Exception.class)
    public RegisterVerifyResponse activateVerifiedUser(String email, String verificationId) {
        User u = userMapper.findByEmail(email);
        if (u == null) {
            // 验证码已校验通过但用户行不存在（注册后管理员删除等）→ 按无效收敛
            throw BusinessException.verifyCodeInvalid(0);
        }
        if ("disabled".equals(u.getStatus())) {
            // 封禁绕过防御：持有有效验证码的 disabled 用户也拒绝激活
            throw BusinessException.userDisabled();
        }
        Instant now = Instant.now();
        if (!"active".equals(u.getStatus())) {
            // SQL 守卫 AND status='pending_verification'：并发封禁/状态漂移时影响行数=0 → 回读判状态给错
            if (userMapper.verifyEmail(u.getId(), now, now) == 0) {
                User fresh = userMapper.getById(u.getId());
                if (fresh == null) {
                    throw BusinessException.verifyCodeInvalid(0);
                }
                if (!"active".equals(fresh.getStatus())) {
                    // disabled（或其它不可激活态）→ 403；并发已激活（active）→ 幂等继续
                    throw BusinessException.userDisabled();
                }
            }
        }
        subscriptionService.bindDefaultFree(u.getId());
        emailVerificationService.markConsumed(verificationId);
        User fresh = userMapper.getById(u.getId());
        log.info("user '{}' verified and activated", u.getUsername());
        return new RegisterVerifyResponse(UserResponse.fromEntity(fresh != null ? fresh : u));
    }

    /** 重发验证码：仅 pending_verification 用户发码；未知/active/disabled 邮箱一律 200 掩码不发（防枚举）。 */
    public RegisterResendResponse resend(String email) {
        User u = userMapper.findByEmail(email);
        if (u == null || !"pending_verification".equals(u.getStatus())) {
            return new RegisterResendResponse(MailService.maskEmail(email), null);
        }
        EmailVerificationService.IssuedCode issued = emailVerificationService.issue(email);
        try {
            mailService.sendVerificationCode(email, issued.code(), EmailVerificationService.CODE_TTL_MINUTES);
        } catch (RuntimeException e) {
            // 发信失败不烧额度：回滚验证码行，冷却/日限只对成功发信计数
            emailVerificationService.discardIssued(issued.verification().getId());
            throw e;
        }
        String devCode = mailService.devEchoEnabled() ? issued.code() : null;
        return new RegisterResendResponse(MailService.maskEmail(email), devCode);
    }

    /** 密码强度：≥8 位且同时含字母与数字（§3.4）。 */
    static boolean isStrongPassword(String password) {
        if (password == null || password.length() < 8) return false;
        boolean hasLetter = false;
        boolean hasDigit = false;
        for (char c : password.toCharArray()) {
            if (Character.isLetter(c)) hasLetter = true;
            else if (Character.isDigit(c)) hasDigit = true;
            if (hasLetter && hasDigit) return true;
        }
        return false;
    }

    /** 与 SiteService/LeadService 同口径：MySQL "Duplicate entry" / H2 "Unique index ..."。 */
    private static boolean isUniqueViolation(DataIntegrityViolationException e) {
        if (e == null || e.getMessage() == null) return false;
        String m = e.getMessage();
        return m.contains("Duplicate") || m.contains("Unique index") || m.contains("primary key violation");
    }
}
