package com.luban.backend.controller;

import com.luban.backend.dto.AbExperimentCreateRequest;
import com.luban.backend.dto.AbExperimentResponse;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.service.AbService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * AB 实验管理端端点（wire-e2e-feature-gaps §D2；鉴权 = 登录用户，AuthFilter 默认 RequireUser，
 * site 归属校验在 AbService 内走 SiteOwnershipGuard）。
 *
 * <p>契约（e2e ab-full-link.spec.ts AB1）：
 * <ul>
 *   <li>GET  /ab/experiments?siteId= → {items:[...], total}（列表可达性 + 鉴权）</li>
 *   <li>POST /ab/experiments {siteId,pageId,name,variants:[{label,weight,...}]} → 实验对象（顶层 id）</li>
 *   <li>POST /ab/experiments/:id/end → 结束（status=ended + ended_at）</li>
 * </ul>
 */
@RestController
@RequestMapping("/ab")
public class AbController {

    private final AbService abService;

    public AbController(AbService abService) {
        this.abService = abService;
    }

    @GetMapping("/experiments")
    public Map<String, Object> list(@RequestParam(value = "siteId", required = false) String siteId) {
        if (siteId == null || siteId.isBlank()) {
            throw BusinessException.invalidArgument("siteId: 必填");
        }
        List<AbExperimentResponse> items = abService.list(siteId);
        return Map.of("items", items, "total", items.size());
    }

    @PostMapping("/experiments")
    public AbExperimentResponse create(@Valid @RequestBody AbExperimentCreateRequest req) {
        return abService.create(req);
    }

    @PostMapping("/experiments/{id}/end")
    public AbExperimentResponse end(@PathVariable String id) {
        return abService.end(id);
    }
}
