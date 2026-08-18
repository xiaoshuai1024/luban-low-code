package com.luban.backend.entity;

import java.time.Instant;

/**
 * site 级功能开关实体；表 feature_gates（uk(site_id, gate_key) 支撑 upsert）。
 * fail-open 语义：无记录即 enabled，不预置行。
 */
public class FeatureGate {
    private String id;
    private String siteId;
    private String gateKey;
    private boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getSiteId() { return siteId; }
    public void setSiteId(String siteId) { this.siteId = siteId; }
    public String getGateKey() { return gateKey; }
    public void setGateKey(String gateKey) { this.gateKey = gateKey; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
