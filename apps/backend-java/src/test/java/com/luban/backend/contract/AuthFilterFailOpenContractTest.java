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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * INTERNAL_AUTH_SECRET 未配置时（本地 dev / 单测）AuthFilter fail-open（design D1）：
 * 仅凭 BFF 注入的 X-User-ID/X-User-Role 即可通过，不打挂本地环境。
 *
 * <p>显式置空 INTERNAL_AUTH_SECRET，避免宿主机环境变量污染本用例。
 */
@SpringBootTest(properties = "INTERNAL_AUTH_SECRET=")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFilterFailOpenContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

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
    void noSecretConfiguredFailsOpenWithUserHeadersOnly() throws Exception {
        mockMvc.perform(get("/backend/auth/me")
                        .contextPath("/backend")
                        .header("X-User-ID", USER_ID)
                        .header("X-User-Role", "admin")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(USER_ID));
    }
}
