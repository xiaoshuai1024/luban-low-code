package com.luban.backend.entity;

import java.time.Instant;

/**
 * AB 分桶记录 entity; table ab_assignments. 唯一 (experiment_id, visitor_id)
 * 支撑分桶一致性：同 visitor 稳定返回同 variant。
 */
public class AbAssignment {
    private String id;
    private String experimentId;
    private String visitorId;
    private String variantId;
    private Instant assignedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getExperimentId() { return experimentId; }
    public void setExperimentId(String experimentId) { this.experimentId = experimentId; }
    public String getVisitorId() { return visitorId; }
    public void setVisitorId(String visitorId) { this.visitorId = visitorId; }
    public String getVariantId() { return variantId; }
    public void setVariantId(String variantId) { this.variantId = variantId; }
    public Instant getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Instant assignedAt) { this.assignedAt = assignedAt; }
}
