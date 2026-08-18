package com.luban.backend.entity;

import java.time.Instant;

/**
 * AB 变体 entity; table ab_variants. weight 为正整数（分流区间权重）；schema_json 可空
 * （对照组常为空 = 沿用原页面渲染）。
 */
public class AbVariant {
    private String id;
    private String experimentId;
    private String variantKey;
    private int weight;
    private String schemaJson;  // 变体页面 schema（raw JSON text）
    private Instant createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getExperimentId() { return experimentId; }
    public void setExperimentId(String experimentId) { this.experimentId = experimentId; }
    public String getVariantKey() { return variantKey; }
    public void setVariantKey(String variantKey) { this.variantKey = variantKey; }
    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }
    public String getSchemaJson() { return schemaJson; }
    public void setSchemaJson(String schemaJson) { this.schemaJson = schemaJson; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
