package com.luban.backend.service;

import com.luban.backend.auth.UserContext;
import com.luban.backend.dto.SiteResponse;
import com.luban.backend.entity.Site;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.CollectionMapper;
import com.luban.backend.mapper.DatasourceMapper;
import com.luban.backend.mapper.FormMapper;
import com.luban.backend.mapper.LeadMapper;
import com.luban.backend.mapper.PageMapper;
import com.luban.backend.mapper.SiteMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class SiteService {

    private static final Pattern SLUG_PATTERN = Pattern.compile("[a-z0-9-]{3,48}");

    private final SiteMapper siteMapper;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();
    // V2 级联删除：删除站点前需先清理子表（FK RESTRICT）
    private final PageMapper pageMapper;
    private final FormMapper formMapper;
    private final LeadMapper leadMapper;
    private final DatasourceMapper datasourceMapper;
    private final CollectionMapper collectionMapper;
    private final SiteOwnershipGuard ownershipGuard;

    public SiteService(SiteMapper siteMapper, PageMapper pageMapper, FormMapper formMapper,
                       LeadMapper leadMapper, DatasourceMapper datasourceMapper, CollectionMapper collectionMapper,
                       SiteOwnershipGuard ownershipGuard) {
        this.siteMapper = siteMapper;
        this.pageMapper = pageMapper;
        this.formMapper = formMapper;
        this.leadMapper = leadMapper;
        this.datasourceMapper = datasourceMapper;
        this.collectionMapper = collectionMapper;
        this.ownershipGuard = ownershipGuard;
    }

    /** T-be-6：非 admin 仅返回 owner=self 的站点（admin 全量，含 NULL 平台站点）。 */
    public List<SiteResponse> list() {
        List<Site> sites = UserContext.isAdmin()
                ? siteMapper.list()
                : siteMapper.listByOwner(UserContext.getUserId());
        return sites.stream().map(SiteResponse::fromEntity).collect(Collectors.toList());
    }

    public SiteResponse get(String id) {
        return SiteResponse.fromEntity(ownershipGuard.assertVisible(id));
    }

    /** T-be-6：create owner=当前登录用户（POST /sites 已放开给登录用户；受 quota_pages 限制）。 */
    public SiteResponse create(String name, String slug, String baseUrl, String status) {
        validateSlug(slug);
        if (status == null || status.isBlank()) status = "active";
        Site site = new Site();
        site.setId(UUID.randomUUID().toString());
        site.setName(name);
        site.setSlug(slug);
        site.setBaseUrl(baseUrl != null ? baseUrl : "");
        site.setOwnerUserId(UserContext.getUserId());
        site.setStatus(status);
        Instant now = Instant.now();
        site.setCreatedAt(now);
        site.setUpdatedAt(now);
        try {
            siteMapper.insert(site);
        } catch (DataIntegrityViolationException e) {
            if (isUniqueViolation(e)) {
                throw BusinessException.slugTaken(slug);
            }
            throw e;
        }
        return SiteResponse.fromEntity(site);
    }

    /** T-be-6：写入守卫（owner 或 admin；owner=NULL 仅 admin）后更新。 */
    public SiteResponse update(String id, String name, String slug, String baseUrl, String status,
                               com.fasterxml.jackson.databind.JsonNode seo, com.fasterxml.jackson.databind.JsonNode analytics) {
        Site site = ownershipGuard.assertCanWrite(id);
        validateSlug(slug);
        site.setName(name);
        site.setSlug(slug);
        site.setBaseUrl(baseUrl != null ? baseUrl : "");
        site.setStatus(status);
        // V2-T2/V2-T10：seo/analytics 为 null 不覆盖（保留旧值）；非 null 才写
        if (seo != null) site.setSeoJson(jsonToString(seo));
        if (analytics != null) site.setAnalyticsJson(jsonToString(analytics));
        site.setUpdatedAt(Instant.now());
        try {
            int n = siteMapper.update(site);
            if (n == 0) throw BusinessException.siteNotFound();
        } catch (DataIntegrityViolationException e) {
            if (isUniqueViolation(e)) {
                throw BusinessException.slugTaken(slug);
            }
            throw e;
        }
        return SiteResponse.fromEntity(site);
    }

    /** T-be-6：向导防抖预检（GET /sites/slug-check）。200 {available:true,slug} / 409 SLUG_TAKEN / 400。 */
    public Map<String, Object> checkSlug(String slug) {
        validateSlug(slug);
        if (siteMapper.getBySlug(slug) != null) {
            throw BusinessException.slugTaken(slug);
        }
        return Map.of("available", true, "slug", slug);
    }

    /** slug 格式校验（create/update/checkSlug 统一口径）：[a-z0-9-]{3,48}，不合规 400 INVALID_ARGUMENT。 */
    private static void validateSlug(String slug) {
        if (slug == null || !SLUG_PATTERN.matcher(slug).matches()) {
            throw BusinessException.invalidArgument("slug: 3-48 位小写字母/数字/-");
        }
    }

    /** V2-T10: JsonNode → 字符串；null 返回 null（保留旧值语义） */
    private String jsonToString(com.fasterxml.jackson.databind.JsonNode node) {
        if (node == null) return null;
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Detect a UNIQUE-constraint violation across DB drivers:
     *   - MySQL: "Duplicate entry ..." (matches Go isDuplicateErr in site_repo.go)
     *   - H2 (MySQL mode, used in tests): "Unique index or primary key violation"
     *
     * Behavior on real MySQL is byte-identical to the prior "Duplicate" check.
     */
    private static boolean isUniqueViolation(DataIntegrityViolationException e) {
        if (e == null || e.getMessage() == null) return false;
        String m = e.getMessage();
        return m.contains("Duplicate") || m.contains("Unique index") || m.contains("primary key violation");
    }

    /**
     * V2 级联删除：先清理所有子表（leads/forms/datasources/collections/pages），
     * 再删 site。pages 删除后 page_versions 由 FK CASCADE 自动清。
     * 解决删除站点时 FK RESTRICT 报 500 的问题。
     * @Transactional：6 次跨表删除原子化，中途失败整体回滚（不残留半删状态）。
     * T-be-6：写入守卫（owner 或 admin）。
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(String id) {
        ownershipGuard.assertCanWrite(id);
        leadMapper.deleteBySiteId(id);
        formMapper.deleteBySiteId(id);
        datasourceMapper.deleteBySiteId(id);
        collectionMapper.deleteBySiteId(id);
        pageMapper.deleteBySiteId(id);
        int n = siteMapper.deleteById(id);
        if (n == 0) throw BusinessException.siteNotFound();
    }
}
