package com.luban.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luban.backend.dto.PageResponse;
import com.luban.backend.entity.Page;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.FormMapper;
import com.luban.backend.mapper.PageMapper;
import com.luban.backend.mapper.SiteMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PageService {

    private final PageMapper pageMapper;
    private final SiteMapper siteMapper;
    private final FormMapper formMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final PageVersionService versionService;

    public PageService(PageMapper pageMapper, SiteMapper siteMapper, FormMapper formMapper,
                       PageVersionService versionService) {
        this.pageMapper = pageMapper;
        this.siteMapper = siteMapper;
        this.formMapper = formMapper;
        this.versionService = versionService;
    }

    public List<PageResponse> list(String siteId) {
        if (siteMapper.getById(siteId) == null) throw BusinessException.siteNotFound();
        return pageMapper.listBySiteId(siteId).stream().map(PageResponse::fromEntity).collect(Collectors.toList());
    }

    public PageResponse get(String siteId, String pageId) {
        Page p = pageMapper.getByIdAndSiteId(pageId, siteId);
        if (p == null) throw BusinessException.pageNotFound();
        return PageResponse.fromEntity(p);
    }

    public PageResponse create(String siteId, String name, String path, String status, JsonNode schema, JsonNode seo) {
        if (siteMapper.getById(siteId) == null) throw BusinessException.siteNotFound();
        if (status == null || status.isBlank()) status = "draft";
        String schemaJson = schemaToJson(schema);
        Page page = new Page();
        page.setId(UUID.randomUUID().toString());
        page.setSiteId(siteId);
        page.setName(name);
        page.setPath(path);
        page.setStatus(status);
        page.setSchemaJson(schemaJson);
        page.setSeoJson(jsonToString(seo));
        Instant now = Instant.now();
        page.setCreatedAt(now);
        page.setUpdatedAt(now);
        try {
            pageMapper.insert(page);
        } catch (DataIntegrityViolationException e) {
            if (e.getMessage() != null && e.getMessage().contains("Duplicate")) {
                throw BusinessException.pagePathConflict();
            }
            throw e;
        }
        // V2-T8：新建后生成首版快照（v1）
        versionService.createSnapshot(page.getId(), schema, "初始版本", null);
        return PageResponse.fromEntity(page);
    }

    public PageResponse update(String siteId, String pageId, String name, String path, String status, JsonNode schema, JsonNode seo) {
        Page page = pageMapper.getByIdAndSiteId(pageId, siteId);
        if (page == null) throw BusinessException.pageNotFound();
        page.setName(name);
        page.setPath(path);
        page.setStatus(status != null ? status : page.getStatus());
        page.setSchemaJson(schemaToJson(schema));
        // V2-T2: seo 为 null 表示不传（保留旧值）；空对象/有值才覆盖
        if (seo != null) {
            page.setSeoJson(jsonToString(seo));
        }
        page.setUpdatedAt(Instant.now());
        try {
            int n = pageMapper.update(page);
            if (n == 0) throw BusinessException.pageNotFound();
        } catch (DataIntegrityViolationException e) {
            if (e.getMessage() != null && e.getMessage().contains("Duplicate")) {
                throw BusinessException.pagePathConflict();
            }
            throw e;
        }
        // V2-T8：保存后生成快照（每次保存一条版本）
        versionService.createSnapshot(page.getId(), schema, "保存", null);
        return PageResponse.fromEntity(page);
    }

    /** 发布页面：置为 published（幂等，重复发布不阻断）。发布时生成"发布"快照（审计/回滚基线）。
     * 仅 JsonProcessingException 不阻塞发布；DB 异常（createSnapshot 同事务）正常传播回滚，避免宽 catch 吞异常致事务 rollback-only 陷阱。 */
    @Transactional(rollbackFor = Exception.class)
    public PageResponse publish(String siteId, String pageId, String actorId) {
        Page page = pageMapper.getByIdAndSiteId(pageId, siteId);
        if (page == null) throw BusinessException.pageNotFound();
        Instant now = Instant.now();
        int n = pageMapper.updateStatus(pageId, siteId, "published", now);
        if (n == 0) throw BusinessException.pageNotFound();
        page.setStatus("published");
        page.setUpdatedAt(now);
        try {
            versionService.createSnapshot(pageId, objectMapper.readTree(page.getSchemaJson()), "发布", actorId);
        } catch (JsonProcessingException ignored) {
            // 仅 JSON 解析失败不阻塞发布
        }
        return PageResponse.fromEntity(page);
    }

    /**
     * 删除页面（事务内级联删表单）。forms.page_id FK（RESTRICT，无 CASCADE）：
     * 若表单下已有 leads，删 forms 被 fk_leads_form 阻止（DataIntegrityViolationException）
     * → 409 PAGE_HAS_LEADS（不再冒泡为 500）。page_versions 由 FK CASCADE 自动清理。
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(String siteId, String pageId) {
        if (pageMapper.getByIdAndSiteId(pageId, siteId) == null) throw BusinessException.pageNotFound();
        try {
            formMapper.deleteByPageId(pageId);
        } catch (DataIntegrityViolationException e) {
            // 与 SiteService 级联删除同型处理：FK 阻止 → 业务 409，事务回滚
            throw BusinessException.pageHasLeads();
        }
        int n = pageMapper.deleteByIdAndSiteId(pageId, siteId);
        if (n == 0) throw BusinessException.pageNotFound();
    }

    private String schemaToJson(JsonNode schema) {
        if (schema == null) return "{}";
        try {
            return objectMapper.writeValueAsString(schema);
        } catch (Exception e) {
            return "{}";
        }
    }

    /** V2-T2: SEO JsonNode → 字符串；null 返回 null（保留旧值语义在调用处判定）。 */
    private String jsonToString(JsonNode node) {
        if (node == null) return null;
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            return null;
        }
    }
}
