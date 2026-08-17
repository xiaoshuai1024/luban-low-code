package com.luban.backend.contract;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * T-be-2 注册契约（plan §8.1/§9.2）：POST /auth/register。
 *
 * MAIL_DEV_ECHO=true（e2e/dev 通道，仅测试 env）：成功路径 201 附 devCode；
 * 生产该 env 缺席时 devCode 恒不出现（fail-closed 由 service/MailServiceTest 覆盖）。
 *
 * 覆盖：201 + emailMasked + devCode / 400 INVALID_ARGUMENT·WEAK_PASSWORD /
 * 409 USERNAME_TAKEN·EMAIL_TAKEN / 免鉴权可达（全部请求无 X-User-* 头）。
 */
@SpringBootTest(properties = "MAIL_DEV_ECHO=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthRegisterContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;

    private static final String MASKED_PATTERN = "^[^@]{1}\\*\\*\\*@.+$";

    private String uid() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private String registerBody(String username, String email, String password) {
        return "{\"username\":\"" + username + "\",\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }

    @Test
    void validRegisterReturns201WithMaskedEmailAndDevCode() throws Exception {
        String username = "reg-" + uid();
        String email = username + "@example.com";
        mockMvc.perform(post("/backend/auth/register")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(username, email, "Passw0rd123")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.emailMasked").value(matchesPattern(MASKED_PATTERN)))
                .andExpect(jsonPath("$.devCode").value(matchesPattern("^[0-9]{6}$")));

        // DB：pending_verification + 明文邮箱（PII，仅库内）+ 密码哈希
        var row = jdbc.queryForMap("SELECT status, email, password FROM users WHERE username = ?", username);
        assertThat(row.get("status")).isEqualTo("pending_verification");
        assertThat(row.get("email")).isEqualTo(email);
        assertThat((String) row.get("password")).doesNotStartWith("Passw0rd123");
    }

    @Test
    void weakPasswordReturns400() throws Exception {
        String username = "reg-" + uid();
        mockMvc.perform(post("/backend/auth/register")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(username, username + "@example.com", "short1")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WEAK_PASSWORD"));
    }

    @Test
    void passwordWithoutDigitReturns400() throws Exception {
        String username = "reg-" + uid();
        mockMvc.perform(post("/backend/auth/register")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(username, username + "@example.com", "onlyletters")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WEAK_PASSWORD"));
    }

    @Test
    void invalidEmailFormatReturns400() throws Exception {
        String username = "reg-" + uid();
        mockMvc.perform(post("/backend/auth/register")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(username, "not-an-email", "Passw0rd123")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ARGUMENT"));
    }

    @Test
    void invalidUsernameFormatReturns400() throws Exception {
        mockMvc.perform(post("/backend/auth/register")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody("Bad Name", "bad-" + uid() + "@example.com", "Passw0rd123")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ARGUMENT"));
    }

    @Test
    void duplicateUsernameReturns409() throws Exception {
        String username = "dup-" + uid();
        Instant now = Instant.now();
        jdbc.update("INSERT INTO users (id, username, name, role, status, password, created_at, updated_at) " +
                "VALUES (?, ?, ?, 'user', 'active', 'x', ?, ?)",
                "user-dup-" + uid(), username, username, now, now);
        mockMvc.perform(post("/backend/auth/register")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(username, "other-" + uid() + "@example.com", "Passw0rd123")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    @Test
    void duplicateEmailReturns409() throws Exception {
        String email = "taken-" + uid() + "@example.com";
        Instant now = Instant.now();
        jdbc.update("INSERT INTO users (id, username, email, name, role, status, password, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, 'user', 'active', 'x', ?, ?)",
                "user-taken-" + uid(), "holder-" + uid(), email, "holder", now, now);
        mockMvc.perform(post("/backend/auth/register")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody("fresh-" + uid(), email, "Passw0rd123")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
    }

    /** §9.3：uk_users_email 多 NULL 不冲突（存量用户无 email 共存）。 */
    @Test
    void multipleNullEmailsCoexistUnderUniqueKey() {
        Instant now = Instant.now();
        int before = countUsers();
        jdbc.update("INSERT INTO users (id, username, name, role, status, password, created_at, updated_at) " +
                "VALUES (?, ?, ?, 'user', 'active', 'x', ?, ?)",
                "user-nullmail-1-" + uid(), "nullmail-1-" + uid(), "n1", now, now);
        jdbc.update("INSERT INTO users (id, username, name, role, status, password, created_at, updated_at) " +
                "VALUES (?, ?, ?, 'user', 'active', 'x', ?, ?)",
                "user-nullmail-2-" + uid(), "nullmail-2-" + uid(), "n2", now, now);
        assertThat(countUsers()).isEqualTo(before + 2);
    }

    private int countUsers() {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class);
        return n != null ? n : 0;
    }
}
