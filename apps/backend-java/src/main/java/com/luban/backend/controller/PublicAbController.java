package com.luban.backend.controller;

import com.luban.backend.dto.AbAssignResponse;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.service.AbService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AB 公开分流端点（免鉴权：AuthFilter 放行 /backend/public/**）。
 *
 * <p>契约（e2e ab-full-link.spec.ts AB2/AB3）：GET /public/ab/assign?visitorId=&pageId=
 * （experimentId 可选直查；缺省按 pageId 解析该页 running 实验）→
 * {experimentId, variantId, variantKey, status}；ended → variantId=null。
 */
@RestController
@RequestMapping("/public/ab")
public class PublicAbController {

    private final AbService abService;

    public PublicAbController(AbService abService) {
        this.abService = abService;
    }

    @GetMapping("/assign")
    public AbAssignResponse assign(
            @RequestParam(value = "experimentId", required = false) String experimentId,
            @RequestParam(value = "pageId", required = false) String pageId,
            @RequestParam(value = "visitorId", required = false) String visitorId) {
        if (visitorId == null || visitorId.isBlank()) {
            throw BusinessException.invalidArgument("visitorId: 必填");
        }
        boolean hasExperimentId = experimentId != null && !experimentId.isBlank();
        boolean hasPageId = pageId != null && !pageId.isBlank();
        if (!hasExperimentId && !hasPageId) {
            throw BusinessException.invalidArgument("experimentId 与 pageId 至少提供一个");
        }
        return abService.assign(hasExperimentId ? experimentId : null, pageId, visitorId);
    }
}
