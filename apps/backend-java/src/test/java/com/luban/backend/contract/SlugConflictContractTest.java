package com.luban.backend.contract;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Contract test for site slug conflict, aligned with luban-backend-go
 * internal/handler/site_handler.go Create() + slug UNIQUE constraint.
 *
 *   POST /backend/sites  (X-User-ID admin required)
 *     - 201 SiteResponse on success
 *     - 409 SLUG_TAKEN when slug already exists
 *
 * signup-billing-onboarding（计划内变更 §7.2-②）：新路径错误码统一 *_TAKEN，
 * SLUG_CONFLICT → SLUG_TAKEN（details.slug）；create 落 owner_user_id（fk_sites_owner），
 * 故 seed 补插 admin-001 用户行。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SlugConflictContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;

    private static final String SLUG = "existing-slug";

    @BeforeEach
    void seed() {
        // pages + datasources FK → sites; delete children first to avoid referential integrity violation.
        jdbc.update("DELETE FROM datasources");
        jdbc.update("DELETE FROM leads");
        jdbc.update("DELETE FROM forms");
        jdbc.update("DELETE FROM pages");
        jdbc.update("DELETE FROM sites");
        Instant now = Instant.now();
        // create 以 X-User-ID 为 owner（T-be-6），fk_sites_owner 需用户行存在
        jdbc.update("MERGE INTO users (id, username, name, role, status, password, created_at, updated_at) " +
                    "KEY(id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                "admin-001", "admin001", "Admin", "admin", "active", "x", now, now);
        jdbc.update("INSERT INTO sites (id, name, slug, base_url, status, created_at, updated_at) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                "site-existing", "Existing", SLUG, "", "active", now, now);
    }

    @Test
    void duplicateSlugReturns409SlugTaken() throws Exception {
        String body = "{\"name\":\"Another\",\"slug\":\"" + SLUG + "\",\"baseUrl\":\"\",\"status\":\"active\"}";
        mockMvc.perform(post("/backend/sites")
                        .contextPath("/backend")
                        .header("X-User-ID", "admin-001")
                        .header("X-User-Role", "admin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SLUG_TAKEN"))
                .andExpect(jsonPath("$.details.slug").value(SLUG));
    }

    @Test
    void uniqueSlugReturns201Created() throws Exception {
        String body = "{\"name\":\"Brand New\",\"slug\":\"brand-new-slug\",\"baseUrl\":\"\",\"status\":\"active\"}";
        mockMvc.perform(post("/backend/sites")
                        .contextPath("/backend")
                        .header("X-User-ID", "admin-001")
                        .header("X-User-Role", "admin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.slug").value("brand-new-slug"));
    }
}
