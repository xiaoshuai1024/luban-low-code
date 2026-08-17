package com.luban.backend.dto;

import java.time.Instant;
import java.util.List;

/** AB 实验响应（含 variants；e2e AB1 直接读顶层 id）。variants 由 AbService 组装（schema 解析在服务层）。 */
public record AbExperimentResponse(
        String id,
        String siteId,
        String pageId,
        String name,
        String status,
        Instant startedAt,
        Instant endedAt,
        Instant createdAt,
        Instant updatedAt,
        List<AbVariantResponse> variants) {
}
