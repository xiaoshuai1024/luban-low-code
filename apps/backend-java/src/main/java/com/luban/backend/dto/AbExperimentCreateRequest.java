package com.luban.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;

import java.util.List;

/**
 * POST /ab/experiments 请求体。
 *
 * <p>契约容错（e2e ab-full-link.spec.ts AB1 创建契约）：
 * <ul>
 *   <li>variants 元素可用 label 作为展示名（无 variantKey 时回落 label，再回落 variant-N）；</li>
 *   <li>trafficPct 接受但本期不持久化（design D2 最小表结构无此列，分流恒 100%）；</li>
 *   <li>status 接受但创建后恒为 running（实验创建即开始，ended 只经 /end 端点到达）；</li>
 *   <li>isControl 接受但本期不持久化（对照组 = variants 首个元素约定）。</li>
 * </ul>
 */
public record AbExperimentCreateRequest(
        @NotBlank String siteId,
        String pageId,
        @NotBlank String name,
        Integer trafficPct,
        String status,
        @NotEmpty @Valid List<VariantPayload> variants) {

    /**
     * 变体载荷：variantKey/label 二选一均可（label 优先 e2e 契约，variantKey 优先显式指定）；
     * weight 正整数（缺省 50）；schema 为变体页面 schema（任意 JSON，可空）。
     */
    public record VariantPayload(
            String variantKey,
            String label,
            @Positive Integer weight,
            Boolean isControl,
            JsonNode schema) {
    }
}
