package com.luban.backend.controller;

import com.luban.backend.dto.FeatureGateResponse;
import com.luban.backend.service.FeatureGateService;
import com.luban.backend.service.SiteOwnershipGuard;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * FeatureGate 端点（wire-e2e-feature-gaps D1；context-path /backend）：
 *
 *   GET  /feature-gates?siteId=         管理端列表（AuthFilter 登录态；归属校验 assertVisible）
 *   PUT  /feature-gates?siteId=&key=&enabled=  管理端配置 upsert（owner/admin，assertCanWrite）
 *   GET  /public/feature-gates?siteId=&key=    公开查询 → {enabled}（AuthFilter /public/** 白名单免鉴权；
 *                                        未知 key fail-open 返回 {enabled:true}，不泄露 site 是否存在）
 */
@RestController
public class FeatureGateController {

    private final FeatureGateService featureGateService;
    private final SiteOwnershipGuard ownershipGuard;

    public FeatureGateController(FeatureGateService featureGateService, SiteOwnershipGuard ownershipGuard) {
        this.featureGateService = featureGateService;
        this.ownershipGuard = ownershipGuard;
    }

    @GetMapping("/feature-gates")
    public List<FeatureGateResponse> list(@RequestParam String siteId) {
        ownershipGuard.assertVisible(siteId);
        return featureGateService.listBySite(siteId).stream()
                .map(FeatureGateResponse::from)
                .collect(Collectors.toList());
    }

    @PutMapping("/feature-gates")
    public FeatureGateResponse set(@RequestParam String siteId,
                                   @RequestParam("key") String key,
                                   @RequestParam boolean enabled) {
        ownershipGuard.assertCanWrite(siteId);
        return FeatureGateResponse.from(featureGateService.setEnabled(siteId, key, enabled));
    }

    @GetMapping("/public/feature-gates")
    public Map<String, Object> publicGet(@RequestParam String siteId, @RequestParam("key") String key) {
        return Map.of("enabled", featureGateService.isEnabled(siteId, key));
    }
}
