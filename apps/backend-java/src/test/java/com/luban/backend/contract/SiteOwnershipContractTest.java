package com.luban.backend.contract;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * 站点归属权限矩阵契约（T-be-6，plan §3.4/S5）：
 *
 *   POST /sites        任意登录用户（owner=self）
 *   GET  /sites        非 admin 仅 owner=self；admin 全量（含 NULL 平台站点）
 *   GET/PUT/DELETE     owner 或 admin；owner=NULL（平台站点）仅 admin
 *   子资源写（pages）   同 PUT/DELETE 矩阵
 *   GET /sites/slug-check 200 available / 409 SLUG_TAKEN / 400
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SiteOwnershipContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;

    private String ownerId;
    private String otherUserId;
    private String adminId;
    private String siteId;        // owner=ownerId
    private String platformSiteId; // owner=NULL
    private String slug;

    @BeforeEach
    void seed() {
        String uid = UUID.randomUUID().toString().substring(0, 8);
        ownerId = "own-" + uid;
        otherUserId = "oth-" + uid;
        adminId = "adm-" + uid;
        siteId = "so-site-" + uid;
        platformSiteId = "so-plat-" + uid;
        slug = "own-" + uid;
        Instant now = Instant.now();
        insertUser(ownerId, "so-owner-" + uid, "user", now);
        insertUser(otherUserId, "so-other-" + uid, "user", now);
        insertUser(adminId, "so-admin-" + uid, "admin", now);
        jdbc.update("INSERT INTO sites (id, name, slug, base_url, owner_user_id, status, created_at, updated_at) " +
                "VALUES (?, ?, ?, '', ?, 'active', ?, ?)", siteId, "归属站", slug, ownerId, now, now);
        jdbc.update("INSERT INTO sites (id, name, slug, base_url, owner_user_id, status, created_at, updated_at) " +
                "VALUES (?, ?, ?, '', NULL, 'active', ?, ?)", platformSiteId, "平台站", "plat-" + uid, now, now);
    }

    @AfterEach
    void cleanup() {
        // owner FK：先删站点（含子表）再删用户；幂等清理不影响其他用例
        for (String sid : new String[]{siteId, platformSiteId}) {
            jdbc.update("DELETE FROM leads WHERE site_id = ?", sid);
            jdbc.update("DELETE FROM forms WHERE site_id = ?", sid);
            jdbc.update("DELETE FROM datasources WHERE site_id = ?", sid);
            jdbc.update("DELETE FROM collections WHERE site_id = ?", sid);
            jdbc.update("DELETE FROM pages WHERE site_id = ?", sid);
            jdbc.update("DELETE FROM sites WHERE id = ?", sid);
        }
        for (String uid2 : new String[]{ownerId, otherUserId, adminId}) {
            jdbc.update("DELETE FROM usage_counters WHERE user_id = ?", uid2);
            jdbc.update("DELETE FROM orders WHERE user_id = ?", uid2);
            jdbc.update("DELETE FROM trial_records WHERE user_id = ?", uid2);
            jdbc.update("DELETE FROM subscriptions WHERE user_id = ?", uid2);
            jdbc.update("DELETE FROM users WHERE id = ?", uid2);
        }
    }

    private void insertUser(String id, String username, String role, Instant now) {
        jdbc.update("INSERT INTO users (id, username, name, role, status, password, created_at, updated_at) " +
                "VALUES (?, ?, ?, ?, 'active', 'x', ?, ?)", id, username, username, role, now, now);
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder b, String userId, String role) {
        return b.contextPath("/backend").header("X-User-ID", userId).header("X-User-Role", role);
    }

    // === POST /sites：放开给登录用户，owner=self ===

    @Test
    void nonAdminUserCanCreateSiteOwnedBySelf() throws Exception {
        String newSlug = "new-" + UUID.randomUUID().toString().substring(0, 8);
        mockMvc.perform(as(post("/backend/sites"), otherUserId, "user")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"我的站\",\"slug\":\"" + newSlug + "\",\"baseUrl\":\"\",\"status\":\"active\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slug").value(newSlug));

        String owner = jdbc.queryForObject("SELECT owner_user_id FROM sites WHERE slug = ?", String.class, newSlug);
        org.assertj.core.api.Assertions.assertThat(owner).isEqualTo(otherUserId);

        jdbc.update("DELETE FROM sites WHERE slug = ?", newSlug);
    }

    @Test
    void createRequiresLogin() throws Exception {
        mockMvc.perform(post("/backend/sites")
                        .contextPath("/backend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\",\"slug\":\"anon-" + UUID.randomUUID().toString().substring(0, 8)
                                + "\",\"baseUrl\":\"\",\"status\":\"active\"}"))
                .andExpect(status().isUnauthorized());
    }

    // === GET /sites：owner 过滤 ===

    @Test
    void listForNonAdminReturnsOnlyOwnedSites() throws Exception {
        mockMvc.perform(as(get("/backend/sites"), ownerId, "user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + siteId + "')]").exists())
                .andExpect(jsonPath("$[?(@.id == '" + platformSiteId + "')]").doesNotExist());
    }

    @Test
    void listForAdminReturnsAllIncludingPlatformSites() throws Exception {
        mockMvc.perform(as(get("/backend/sites"), adminId, "admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == '" + siteId + "')]").exists())
                .andExpect(jsonPath("$[?(@.id == '" + platformSiteId + "')]").exists());
    }

    // === 单站读取矩阵 ===

    @Test
    void getSiteMatrixOwnerOtherAdmin() throws Exception {
        mockMvc.perform(as(get("/backend/sites/" + siteId), ownerId, "user")).andExpect(status().isOk());
        mockMvc.perform(as(get("/backend/sites/" + siteId), otherUserId, "user"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
        mockMvc.perform(as(get("/backend/sites/" + siteId), adminId, "admin")).andExpect(status().isOk());
    }

    @Test
    void getPlatformSiteAdminOnly() throws Exception {
        mockMvc.perform(as(get("/backend/sites/" + platformSiteId), otherUserId, "user"))
                .andExpect(status().isForbidden());
        mockMvc.perform(as(get("/backend/sites/" + platformSiteId), adminId, "admin"))
                .andExpect(status().isOk());
    }

    // === 更新矩阵（PUT 下沉 guard 后 owner 可写） ===

    @Test
    void updateMatrixOwnerCanWriteOtherForbiddenAdminCanWrite() throws Exception {
        String body = "{\"name\":\"改名\",\"slug\":\"" + slug + "\",\"baseUrl\":\"\",\"status\":\"active\"}";
        mockMvc.perform(as(put("/backend/sites/" + siteId), ownerId, "user")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("改名"));
        mockMvc.perform(as(put("/backend/sites/" + siteId), otherUserId, "user")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
        mockMvc.perform(as(put("/backend/sites/" + platformSiteId), ownerId, "user")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"平台\",\"slug\":\"plat\",\"baseUrl\":\"\",\"status\":\"active\"}"))
                .andExpect(status().isForbidden()); // owner=NULL 平台站点仅 admin
        mockMvc.perform(as(put("/backend/sites/" + siteId), adminId, "admin")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    // === 删除矩阵 ===

    @Test
    void deleteForbiddenForNonOwnerThenOwnerSucceeds() throws Exception {
        mockMvc.perform(as(delete("/backend/sites/" + siteId), otherUserId, "user"))
                .andExpect(status().isForbidden());
        org.assertj.core.api.Assertions.assertThat(
                jdbc.queryForObject("SELECT COUNT(*) FROM sites WHERE id = ?", Integer.class, siteId)).isEqualTo(1);

        mockMvc.perform(as(delete("/backend/sites/" + siteId), ownerId, "user"))
                .andExpect(status().isNoContent());
        org.assertj.core.api.Assertions.assertThat(
                jdbc.queryForObject("SELECT COUNT(*) FROM sites WHERE id = ?", Integer.class, siteId)).isEqualTo(0);
    }

    // === 子资源写守卫（pages，S5 断言） ===

    @Test
    void pageCreateUnderOthersSiteForbiddenForNonOwner() throws Exception {
        String pageBody = "{\"name\":\"首页\",\"path\":\"/\",\"schema\":{\"root\":{}}}";
        mockMvc.perform(as(post("/backend/sites/" + siteId + "/pages"), otherUserId, "user")
                        .contentType(MediaType.APPLICATION_JSON).content(pageBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PERMISSION_DENIED"));
        mockMvc.perform(as(post("/backend/sites/" + siteId + "/pages"), ownerId, "user")
                        .contentType(MediaType.APPLICATION_JSON).content(pageBody))
                .andExpect(status().isCreated());
        mockMvc.perform(as(post("/backend/sites/" + platformSiteId + "/pages"), otherUserId, "user")
                        .contentType(MediaType.APPLICATION_JSON).content(pageBody))
                .andExpect(status().isForbidden()); // 平台站点仅 admin
    }

    // === slug-check ===

    @Test
    void slugCheckAvailableThenTaken() throws Exception {
        String free = "free-" + UUID.randomUUID().toString().substring(0, 8);
        mockMvc.perform(as(get("/backend/sites/slug-check"), ownerId, "user").queryParam("slug", free))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.slug").value(free));
        mockMvc.perform(as(get("/backend/sites/slug-check"), ownerId, "user").queryParam("slug", slug))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SLUG_TAKEN"))
                .andExpect(jsonPath("$.details.slug").value(slug));
    }

    @Test
    void slugCheckRejectsInvalidFormat() throws Exception {
        mockMvc.perform(as(get("/backend/sites/slug-check"), ownerId, "user").queryParam("slug", "Bad_Slug"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ARGUMENT"));
    }

    @Test
    void slugCheckPathWinsOverSiteIdTemplate() throws Exception {
        // 字面段优先：/sites/slug-check 不被 /sites/{id} 吞掉（404）
        mockMvc.perform(as(get("/backend/sites/slug-check"), ownerId, "user").queryParam("slug", "abc-def"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true));
    }
}
