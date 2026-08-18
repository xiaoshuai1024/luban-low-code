package com.luban.backend.dto;

import com.luban.backend.entity.FeatureGate;

import java.time.Instant;

/** FeatureGate 对外视图（管理端 GET/PUT 共用）。 */
public record FeatureGateResponse(String siteId, String gateKey, boolean enabled,
                                  Instant createdAt, Instant updatedAt) {

    public static FeatureGateResponse from(FeatureGate gate) {
        return new FeatureGateResponse(gate.getSiteId(), gate.getGateKey(), gate.isEnabled(),
                gate.getCreatedAt(), gate.getUpdatedAt());
    }
}
