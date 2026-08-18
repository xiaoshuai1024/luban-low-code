package com.luban.backend.service;

import com.luban.backend.exception.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * 注册验证码邮件发送（T-be-2）。
 *
 * 行为（fail-closed，auth-security-policy）：
 *  - MAIL_DEV_ECHO=true（仅 dev/e2e env；生产 compose 审计项 G2 必须缺席）→ 不外发，
 *    仅打点日志（邮箱掩码、码不落日志），调用方在响应体附 devCode 供 e2e 填 OTP；
 *  - SMTP_HOST 为空且非 echo → 503 EMAIL_SERVICE_UNAVAILABLE（注册入口不可用而非静默丢码）；
 *  - SMTP_HOST 配置 → spring-boot-starter-mail 自动装配 JavaMailSender 真发信（纯文本含 6 位码）。
 *
 * 凭证全部来自 env（SMTP_*），禁入仓禁日志（敏感字段清单 §12）。
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String smtpHost;
    private final String smtpFrom;
    private final boolean devEcho;

    public MailService(ObjectProvider<JavaMailSender> mailSenderProvider,
                       @Value("${SMTP_HOST:}") String smtpHost,
                       @Value("${SMTP_FROM:}") String smtpFrom,
                       @Value("${MAIL_DEV_ECHO:false}") boolean devEcho) {
        this.mailSenderProvider = mailSenderProvider;
        this.smtpHost = smtpHost != null ? smtpHost.trim() : "";
        this.smtpFrom = smtpFrom != null ? smtpFrom.trim() : "";
        this.devEcho = devEcho;
    }

    /** e2e/dev 通道开关：true 时响应体可附 devCode（RegisterService 消费）。 */
    public boolean devEchoEnabled() {
        return devEcho;
    }

    /** 发送验证码邮件。dev-echo 通道不外发；缺 SMTP 配置或发送失败 → 503（fail-closed）。 */
    public void sendVerificationCode(String email, String code, int ttlMinutes) {
        if (devEcho) {
            // 码不落日志（§12）；仅记录掩码邮箱与事件本身
            log.info("mail dev-echo: verification code issued for {}", maskEmail(email));
            return;
        }
        if (smtpHost.isEmpty()) {
            throw BusinessException.emailServiceUnavailable();
        }
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            throw BusinessException.emailServiceUnavailable();
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(smtpFrom.isEmpty() ? "no-reply@luban.local" : smtpFrom);
            message.setTo(email);
            message.setSubject("Luban 账号验证码");
            message.setText("你的验证码是：" + code + "，" + ttlMinutes + " 分钟内有效。如非本人操作请忽略本邮件。");
            sender.send(message);
        } catch (MailException e) {
            log.error("verification mail send failed for {}: {}", maskEmail(email), e.getMessage());
            throw BusinessException.emailServiceUnavailable();
        }
    }

    /** 日志脱敏：a***@domain.com（与响应 emailMasked 同规则）。 */
    static String maskEmail(String email) {
        if (email == null || email.isBlank() || !email.contains("@")) return "***";
        String local = email.substring(0, email.indexOf('@'));
        String domain = email.substring(email.indexOf('@') + 1);
        if (local.isEmpty()) return "***@" + domain;
        return local.charAt(0) + "***@" + domain;
    }
}
