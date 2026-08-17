package com.luban.backend.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultMatcher;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * T-be-2 验证/激活契约（plan §8.1/§9.2）：POST /auth/register/verify · /resend · login pending 拒绝。
 *
 * MAIL_DEV_ECHO=true 通道取 devCode 填 OTP（e2e 同款机制）。
 * 覆盖：verify 成功事务（active+Free 订阅+消费码）/ 错码含剩余次数 / 已消费码 / 过期 /
 * 尝试上限 / 重发冷却 / 旧码作废 / pending 登录 401 / 未知邮箱防枚举。
 */
@SpringBootTest(properties = "MAIL_DEV_ECHO=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RegisterVerifyContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();

    private String uid() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    /** 注册并返回 devCode（成功 201 契约由 AuthRegisterContractTest 覆盖）。 */
    private String registerAndFetchCode(String username, String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/backend/auth/register")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"email\":\"" + email
                                + "\",\"password\":\"Passw0rd123\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).get("devCode").asText();
    }

    private void verify(String email, String code, int expectedStatus, String expectedErrorCode) throws Exception {
        ResultMatcher codeMatcher = expectedErrorCode != null
                ? jsonPath("$.code").value(expectedErrorCode)
                : jsonPath("$.code").doesNotExist();
        mockMvc.perform(post("/backend/auth/register/verify")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}"))
                .andExpect(status().is(expectedStatus))
                .andExpect(codeMatcher);
    }

    @Test
    void verifyActivatesUserBindsFreeAndConsumesCodeAtomically() throws Exception {
        String username = "vfy-" + uid();
        String email = username + "@example.com";
        String code = registerAndFetchCode(username, email);

        mockMvc.perform(post("/backend/auth/register/verify")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username").value(username))
                .andExpect(jsonPath("$.user.status").value("active"))
                .andExpect(jsonPath("$.user.role").value("user"))
                .andExpect(jsonPath("$.user.id").exists());

        // 事务原子性落库验证：user active+email_verified_at + 默认订阅 free/active + 验证码已消费
        var user = jdbc.queryForMap(
                "SELECT u.status, u.email_verified_at, s.plan_code, s.status AS sub_status " +
                "FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id WHERE u.username = ?", username);
        assertThat(user.get("status")).isEqualTo("active");
        assertThat(user.get("email_verified_at")).isNotNull();
        assertThat(user.get("plan_code")).isEqualTo("free");
        assertThat(user.get("sub_status")).isEqualTo("active");
        Integer consumed = jdbc.queryForObject(
                "SELECT COUNT(*) FROM email_verifications WHERE email = ? AND consumed_at IS NOT NULL",
                Integer.class, email);
        assertThat(consumed).isEqualTo(1);
    }

    @Test
    void wrongCodeReturns400WithRemainingAttemptsThenSucceeds() throws Exception {
        String username = "vfy-" + uid();
        String email = username + "@example.com";
        String code = registerAndFetchCode(username, email);
        String wrongCode = code.equals("000001") ? "000002" : "000001";

        mockMvc.perform(post("/backend/auth/register/verify")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"code\":\"" + wrongCode + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERIFY_CODE_INVALID"))
                .andExpect(jsonPath("$.details.remainingAttempts").value(4));

        verify(email, code, 200, null);
    }

    @Test
    void pendingUserCannotLoginUntilVerified() throws Exception {
        String username = "vfy-" + uid();
        String email = username + "@example.com";
        String code = registerAndFetchCode(username, email);

        // §3.2 非法态：pending 直接 login → 401 USER_PENDING_VERIFICATION（文案「邮箱未验证」）
        mockMvc.perform(post("/backend/auth/login")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"Passw0rd123\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("USER_PENDING_VERIFICATION"));

        verify(email, code, 200, null);

        mockMvc.perform(post("/backend/auth/login")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"Passw0rd123\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void consumedCodeCannotBeReused() throws Exception {
        String username = "vfy-" + uid();
        String email = username + "@example.com";
        String code = registerAndFetchCode(username, email);
        verify(email, code, 200, null);
        verify(email, code, 400, "VERIFY_CODE_INVALID");
    }

    @Test
    void expiredCodeReturns400Expired() throws Exception {
        String username = "vfy-" + uid();
        String email = username + "@example.com";
        String code = registerAndFetchCode(username, email);
        jdbc.update("UPDATE email_verifications SET expires_at = ? WHERE email = ?",
                Instant.now().minusSeconds(3600), email);
        verify(email, code, 400, "VERIFY_CODE_EXPIRED");
    }

    @Test
    void fiveFailuresExhaustAttempts() throws Exception {
        String username = "vfy-" + uid();
        String email = username + "@example.com";
        String code = registerAndFetchCode(username, email);
        String wrongCode = code.equals("123456") ? "654321" : "123456";

        // 第 1-4 次：INVALID + 递减剩余次数；第 5 次：attempts 达上限 → EXCEEDED
        for (int i = 1; i <= 4; i++) {
            mockMvc.perform(post("/backend/auth/register/verify")
                            .contextPath("/backend")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"code\":\"" + wrongCode + "\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VERIFY_CODE_INVALID"))
                    .andExpect(jsonPath("$.details.remainingAttempts").value(5 - i));
        }
        verify(email, wrongCode, 400, "VERIFY_ATTEMPTS_EXCEEDED");
        // 上限后即使正确码也拒绝（须重新发送）
        verify(email, code, 400, "VERIFY_ATTEMPTS_EXCEEDED");
    }

    @Test
    void unknownEmailVerifyReturnsInvalidNotUserEnumeration() throws Exception {
        verify("nobody-" + uid() + "@example.com", "123456", 400, "VERIFY_CODE_INVALID");
    }

    @Test
    void resendWithinCooldownReturns429() throws Exception {
        String username = "vfy-" + uid();
        String email = username + "@example.com";
        registerAndFetchCode(username, email);

        mockMvc.perform(post("/backend/auth/register/resend")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("VERIFY_RESEND_COOLDOWN"));
    }

    @Test
    void resendInvalidatesOldCode() throws Exception {
        String username = "vfy-" + uid();
        String email = username + "@example.com";
        String oldCode = registerAndFetchCode(username, email);
        // 移除旧行以绕过 60s 冷却（单元化验证「旧码作废」语义；冷却契约由上一用例锁定）
        jdbc.update("DELETE FROM email_verifications WHERE email = ?", email);

        MvcResult result = mockMvc.perform(post("/backend/auth/register/resend")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailMasked").exists())
                .andReturn();
        String newCode = mapper.readTree(result.getResponse().getContentAsString()).get("devCode").asText();
        assertThat(newCode).matches("^[0-9]{6}$");

        verify(email, oldCode, 400, "VERIFY_CODE_INVALID");
        verify(email, newCode, 200, null);
    }

    @Test
    void resendUnknownEmailReturns200WithoutCode() throws Exception {
        // 防枚举：未知邮箱回 200 掩码、无 devCode、不发码
        mockMvc.perform(post("/backend/auth/register/resend")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ghost-" + uid() + "@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailMasked").exists())
                .andExpect(jsonPath("$.devCode").doesNotExist());
    }
}
