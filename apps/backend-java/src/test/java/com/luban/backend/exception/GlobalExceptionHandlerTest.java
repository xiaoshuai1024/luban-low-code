package com.luban.backend.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * GlobalExceptionHandler 单测（close-tech-debt-1 3.3）：
 * 500 响应不泄露内部信息（SQL/约束/连接串细节仅记日志），已映射错误码（BusinessException 等）不变。
 * 断言覆盖序列化后的完整响应体，防止 details 等字段间接带出内部细节。
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    // === 已映射错误码不变（BusinessException 原样透传 code/message/status） ===

    @Test
    void businessExceptionKeepsMappedCodeStatusAndMessage() {
        ResponseEntity<APIError> resp = handler.handleBusiness(BusinessException.leadSpamBlocked());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(resp.getBody().code()).isEqualTo("LEAD_SPAM_BLOCKED");
        assertThat(resp.getBody().message()).isEqualTo("操作过于频繁，请稍后再试");
    }

    // === 500 收敛（spec：DB 约束异常 → 通用 INTERNAL，无 SQL 细节） ===

    @Test
    void dataIntegrityViolationReturnsGeneric500WithoutSqlDetails() throws Exception {
        DataIntegrityViolationException ex = new DataIntegrityViolationException(
                "INSERT INTO leads(id, dedup_hash) VALUES ('l1', 'h1'); "
                        + "Unique index or primary key violation: uk_form_dedup ON leads");

        ResponseEntity<APIError> resp = handler.handleDataIntegrity(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(resp.getBody().code()).isEqualTo("INTERNAL");
        assertThat(resp.getBody().message()).isEqualTo("服务器内部错误");
        assertThat(resp.getBody().details()).isNull();
        // 完整序列化响应体不含 SQL/约束细节
        String body = new ObjectMapper().writeValueAsString(resp.getBody());
        assertThat(body).doesNotContain("INSERT");
        assertThat(body).doesNotContain("uk_form_dedup");
        assertThat(body).doesNotContain("Unique index");
    }

    @Test
    void unmappedExceptionReturnsGeneric500WithoutInternalDetails() throws Exception {
        RuntimeException ex = new RuntimeException(
                "jdbc:mysql://10.0.0.5:3306/luban?user=root SELECT * FROM users WHERE password_hash='x'");

        ResponseEntity<APIError> resp = handler.handleOther(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(resp.getBody().code()).isEqualTo("INTERNAL");
        assertThat(resp.getBody().message()).isEqualTo("服务器内部错误");
        String body = new ObjectMapper().writeValueAsString(resp.getBody());
        assertThat(body).doesNotContain("jdbc");
        assertThat(body).doesNotContain("SELECT");
        assertThat(body).doesNotContain("password_hash");
    }
}
