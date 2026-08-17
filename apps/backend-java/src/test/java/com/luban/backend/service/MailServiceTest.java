package com.luban.backend.service;

import com.luban.backend.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * MailService 行为单测（T-be-2 补充，503 fail-closed 契约在单测锁定）：
 * dev-echo 不外发 / 缺 SMTP host → 503 / sender 缺失 → 503 / 配置齐 → 真发纯文本含 6 位码。
 */
class MailServiceTest {

    @SuppressWarnings("unchecked")
    private ObjectProvider<JavaMailSender> provider(JavaMailSender sender) {
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(sender);
        return provider;
    }

    @Test
    void devEchoSkipsSendAndExposesFlag() {
        MailService service = new MailService(provider(null), "", "", true);
        assertThat(service.devEchoEnabled()).isTrue();
        assertThatCode(() -> service.sendVerificationCode("alice@example.com", "123456", 10))
                .doesNotThrowAnyException(); // 不外发也绝不 503
    }

    @Test
    void missingHostWithoutEchoFailsClosedWith503() {
        MailService service = new MailService(provider(null), "", "", false);
        assertThatThrownBy(() -> service.sendVerificationCode("alice@example.com", "123456", 10))
                .isInstanceOfSatisfying(BusinessException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("EMAIL_SERVICE_UNAVAILABLE");
                    assertThat(e.getHttpStatus().value()).isEqualTo(503);
                });
    }

    @Test
    void missingSenderBeanFailsClosedWith503() {
        MailService service = new MailService(provider(null), "smtp.example.com", "no-reply@example.com", false);
        assertThatThrownBy(() -> service.sendVerificationCode("alice@example.com", "123456", 10))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo("EMAIL_SERVICE_UNAVAILABLE"));
    }

    @Test
    void configuredSmtpSendsPlainTextWithCode() {
        JavaMailSender sender = mock(JavaMailSender.class);
        MailService service = new MailService(provider(sender), "smtp.example.com", "no-reply@example.com", false);

        service.sendVerificationCode("alice@example.com", "654321", 10);

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(captor.capture());
        SimpleMailMessage message = captor.getValue();
        assertThat(message.getTo()).containsExactly("alice@example.com");
        assertThat(message.getFrom()).isEqualTo("no-reply@example.com");
        assertThat(message.getText()).contains("654321").contains("10");
    }

    @Test
    void sendFailureSurfacesAs503() {
        JavaMailSender sender = mock(JavaMailSender.class);
        org.mockito.Mockito.doThrow(new org.springframework.mail.MailSendException("smtp down"))
                .when(sender).send(any(SimpleMailMessage.class));
        MailService service = new MailService(provider(sender), "smtp.example.com", "", false);

        assertThatThrownBy(() -> service.sendVerificationCode("alice@example.com", "123456", 10))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo("EMAIL_SERVICE_UNAVAILABLE"));
    }

    @Test
    void maskEmailKeepsFirstCharOfLocalPartOnly() {
        assertThat(MailService.maskEmail("alice@example.com")).isEqualTo("a***@example.com");
        assertThat(MailService.maskEmail("b@x.io")).isEqualTo("b***@x.io");
        assertThat(MailService.maskEmail("")).isEqualTo("***");
        assertThat(MailService.maskEmail(null)).isEqualTo("***");
    }
}
