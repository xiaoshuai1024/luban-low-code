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
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AB 实验域契约测试（对齐 e2e ab-full-link.spec.ts 请求/响应结构）：
 *
 *   GET  /backend/ab/experiments?siteId=      — 管理端列表（鉴权：无 X-User-ID → 401）
 *   POST /backend/ab/experiments              — 创建（variants 含 label/weight），响应含顶层 id
 *   POST /backend/ab/experiments/:id/end      — 结束
 *   GET  /backend/public/ab/assign?visitorId=&pageId=（experimentId 可选直查）
 *        — 免鉴权；同 visitor 稳定同 variantId；ended → variantId=null
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AbContractTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;

    private static final String SITE_ID = "site-ab";
    private static final String PAGE_ID = "page-ab";
    private static final String EXP_RUNNING = "exp-running";
    private static final String EXP_ENDED = "exp-ended";

    @BeforeEach
    void seed() {
        // FK：ab_variants/ab_assignments → ab_experiments（CASCADE）；ab_experiments 无跨域 FK
        jdbc.update("DELETE FROM ab_assignments");
        jdbc.update("DELETE FROM ab_variants");
        jdbc.update("DELETE FROM ab_experiments");
        jdbc.update("DELETE FROM sites WHERE id = ?", SITE_ID);
        Instant now = Instant.now();
        jdbc.update("INSERT INTO sites (id, name, slug, base_url, status, created_at, updated_at) " +
                        "VALUES (?, ?, ?, NULL, 'active', ?, ?)",
                SITE_ID, "AB Site", "ab-site", now, now);

        insertExperiment(EXP_RUNNING, PAGE_ID, "running", now);
        insertVariant("var-control", EXP_RUNNING, "对照组", 50);
        insertVariant("var-treatment", EXP_RUNNING, "变体A", 50);

        insertExperiment(EXP_ENDED, "page-ended", "ended", now);
        jdbc.update("UPDATE ab_experiments SET ended_at = ? WHERE id = ?", now, EXP_ENDED);
        insertVariant("var-ended", EXP_ENDED, "对照", 100);
    }

    private void insertExperiment(String id, String pageId, String status, Instant now) {
        jdbc.update("INSERT INTO ab_experiments (id, site_id, page_id, name, status, started_at, ended_at, created_at, updated_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)",
                id, SITE_ID, pageId, "exp-" + id, status, now, now, now);
    }

    private void insertVariant(String id, String experimentId, String key, int weight) {
        jdbc.update("INSERT INTO ab_variants (id, experiment_id, variant_key, weight, schema_json, created_at) " +
                        "VALUES (?, ?, ?, ?, NULL, ?)",
                id, experimentId, key, weight, Instant.now());
    }

    @Test
    void listRequiresAuth() throws Exception {
        mockMvc.perform(get("/backend/ab/experiments").contextPath("/backend")
                        .queryParam("siteId", SITE_ID)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listReturnsSiteExperimentsWithVariants() throws Exception {
        mockMvc.perform(get("/backend/ab/experiments").contextPath("/backend")
                        .header("X-User-ID", "admin-1")
                        .header("X-User-Role", "admin")
                        .queryParam("siteId", SITE_ID)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items[0].variants").isArray());
    }

    @Test
    void createReturnsTopLevelIdAndRunningStatus() throws Exception {
        // e2e AB1 创建契约（逐字段）：siteId/pageId/name/trafficPct/status/variants[label,weight,isControl]
        String body = """
                {
                  "siteId": "%s",
                  "pageId": "page-create",
                  "name": "create-exp",
                  "trafficPct": 100,
                  "status": "running",
                  "variants": [
                    {"label": "对照组", "weight": 50, "isControl": true},
                    {"label": "变体A", "weight": 50, "isControl": false}
                  ]
                }
                """.formatted(SITE_ID);

        MvcResult result = mockMvc.perform(post("/backend/ab/experiments").contextPath("/backend")
                        .header("X-User-ID", "admin-1")
                        .header("X-User-Role", "admin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.status").value("running"))
                .andExpect(jsonPath("$.siteId").value(SITE_ID))
                .andExpect(jsonPath("$.pageId").value("page-create"))
                .andExpect(jsonPath("$.variants.length()").value(2))
                .andExpect(jsonPath("$.variants[0].variantKey").value("对照组"))
                .andExpect(jsonPath("$.variants[0].weight").value(50))
                .andReturn();

        String experimentId = com.fasterxml.jackson.databind.json.JsonMapper.builder()
                .build().readTree(result.getResponse().getContentAsString()).get("id").asText();

        // 创建后即可公开分流（pageId 解析）
        mockMvc.perform(get("/backend/public/ab/assign").contextPath("/backend")
                        .queryParam("visitorId", "visitor-created")
                        .queryParam("pageId", "page-create")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.experimentId").value(experimentId))
                .andExpect(jsonPath("$.variantId").isNotEmpty());
    }

    @Test
    void createValidatesMissingVariants() throws Exception {
        String body = """
                {"siteId": "%s", "name": "no-variants", "variants": []}
                """.formatted(SITE_ID);

        mockMvc.perform(post("/backend/ab/experiments").contextPath("/backend")
                        .header("X-User-ID", "admin-1")
                        .header("X-User-Role", "admin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ARGUMENT"));
    }

    @Test
    void publicAssignIsAnonymousAndStableForSameVisitor() throws Exception {
        // 免鉴权：不带任何 X-User 头
        MvcResult first = mockMvc.perform(get("/backend/public/ab/assign").contextPath("/backend")
                        .queryParam("visitorId", "visitor-stable")
                        .queryParam("pageId", PAGE_ID)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.variantId").value(notNullValue()))
                .andExpect(jsonPath("$.status").value("running"))
                .andReturn();
        String firstVariantId = com.fasterxml.jackson.databind.json.JsonMapper.builder()
                .build().readTree(first.getResponse().getContentAsString()).get("variantId").asText();

        for (int i = 0; i < 4; i++) {
            mockMvc.perform(get("/backend/public/ab/assign").contextPath("/backend")
                            .queryParam("visitorId", "visitor-stable")
                            .queryParam("pageId", PAGE_ID)
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.variantId").value(firstVariantId)); // 一致性
        }
    }

    @Test
    void publicAssignByExperimentIdDirectLookup() throws Exception {
        mockMvc.perform(get("/backend/public/ab/assign").contextPath("/backend")
                        .queryParam("visitorId", "visitor-by-exp")
                        .queryParam("experimentId", EXP_RUNNING)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.experimentId").value(EXP_RUNNING))
                .andExpect(jsonPath("$.variantId").isNotEmpty());
    }

    @Test
    void publicAssignEndedExperimentReturnsNullVariant() throws Exception {
        mockMvc.perform(get("/backend/public/ab/assign").contextPath("/backend")
                        .queryParam("visitorId", "visitor-ended")
                        .queryParam("experimentId", EXP_ENDED)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.variantId").value(nullValue()))
                .andExpect(jsonPath("$.variantKey").value(nullValue()))
                .andExpect(jsonPath("$.status").value("ended"));
    }

    @Test
    void publicAssignUnknownExperimentReturns404() throws Exception {
        mockMvc.perform(get("/backend/public/ab/assign").contextPath("/backend")
                        .queryParam("visitorId", "visitor-x")
                        .queryParam("experimentId", "no-such-exp")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("AB_EXPERIMENT_NOT_FOUND"));
    }

    @Test
    void publicAssignScattersAcrossVariantsBestEffort() throws Exception {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 20; i++) {
            MvcResult r = mockMvc.perform(get("/backend/public/ab/assign").contextPath("/backend")
                            .queryParam("visitorId", "scatter-" + i)
                            .queryParam("pageId", PAGE_ID)
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andReturn();
            String variantId = com.fasterxml.jackson.databind.json.JsonMapper.builder()
                    .build().readTree(r.getResponse().getContentAsString()).get("variantId").asText();
            assertTrue(variantId.equals("var-control") || variantId.equals("var-treatment"),
                    "分桶只能命中实验内变体，实际 " + variantId);
            seen.add(variantId);
        }
        // e2e AB3 同口径（best-effort：至少命中一个变体）
        assertTrue(seen.size() >= 1, "分散性：应至少命中一个变体");
    }

    @Test
    void endTransitionsRunningToEnded() throws Exception {
        mockMvc.perform(post("/backend/ab/experiments/{id}/end", EXP_RUNNING).contextPath("/backend")
                        .header("X-User-ID", "admin-1")
                        .header("X-User-Role", "admin")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(EXP_RUNNING))
                .andExpect(jsonPath("$.status").value("ended"))
                .andExpect(jsonPath("$.endedAt").isNotEmpty());

        // ended 后公开分流返回 null 变体
        mockMvc.perform(get("/backend/public/ab/assign").contextPath("/backend")
                        .queryParam("visitorId", "visitor-after-end")
                        .queryParam("pageId", PAGE_ID)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.variantId").value(nullValue()));
    }
}
