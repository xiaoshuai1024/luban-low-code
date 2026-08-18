package com.luban.backend.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Security contract test for the internal shared secret (design D1):
 * 配置 INTERNAL_AUTH_SECRET 后，非公开请求必须携带匹配的 X-Internal-Auth 头，
 * 防止客户端直连 backend 伪造 X-User-ID / X-User-Role。
 *
 *   - 伪造 X-User-* 直连（无 X-Internal-Auth）      → 401 UNAUTHENTICATED
 *   - X-Internal-Auth 错误                           → 401 UNAUTHENTICATED
 *   - BFF 带正确密钥 + 用户头                        → 200
 *   - /backend/healthz 匿名（无任何头）              → 200（prod 容器健康检查）
 *   - GET /backend/leads/export 非 admin             → 403 PERMISSION_DENIED
 */
@SpringBootTest(properties = "INTERNAL_AUTH_SECRET=contract-secret-1")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InternalAuthContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

    private static final String SECRET = "contract-secret-1";
    private static final String USER_ID = "user-001";

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM users");
        Instant now = Instant.now();
        jdbc.update("INSERT INTO users (id, username, name, role, status, password, created_at, updated_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                USER_ID, "alice", "Alice Lee", "admin", "active",
                passwordEncoder.encode("secret-pw"), now, now);
    }

    @Test
    void forgedUserHeadersWithoutInternalAuthReturn401() throws Exception {
        // 直连 backend 伪造 X-User-ID/X-User-Role，缺少共享密钥 → 401
        mockMvc.perform(get("/backend/auth/me")
                        .contextPath("/backend")
                        .header("X-User-ID", USER_ID)
                        .header("X-User-Role", "admin")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void wrongInternalAuthSecretReturns401() throws Exception {
        mockMvc.perform(get("/backend/auth/me")
                        .contextPath("/backend")
                        .header("X-User-ID", USER_ID)
                        .header("X-User-Role", "admin")
                        .header("X-Internal-Auth", "wrong-secret")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void correctInternalAuthSecretPasses() throws Exception {
        // BFF 转发路径：带正确密钥 + 用户头 → 200
        mockMvc.perform(get("/backend/auth/me")
                        .contextPath("/backend")
                        .header("X-User-ID", USER_ID)
                        .header("X-User-Role", "admin")
                        .header("X-Internal-Auth", SECRET)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(USER_ID));
    }

    @Test
    void healthzIsAnonymousAndReturns200() throws Exception {
        // 无任何头（prod 容器健康检查场景）→ 200；不得被过滤器链拦截为 401
        mockMvc.perform(get("/backend/healthz")
                        .contextPath("/backend"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void leadsExportAsNonAdminReturns403() throws Exception {
        // 明文 CSV 导出（解密 contact）收紧为 admin-only
        mockMvc.perform(get("/backend/leads/export")
                        .contextPath("/backend")
                        .param("siteId", "site-a")
                        .header("X-User-ID", USER_ID)
                        .header("X-User-Role", "user")
                        .header("X-Internal-Auth", SECRET))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
    }
}
