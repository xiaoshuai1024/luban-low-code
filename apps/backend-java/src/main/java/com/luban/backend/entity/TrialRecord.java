package com.luban.backend.entity;

import java.time.Instant;

/**
 * 试用记录实体；表 trial_records（uk(user_id, plan_code) 支撑「Starter 首次试用」判定；
 * converted_to 记录降级去向，如 free）。
 */
public class TrialRecord {
    private String id;
    private String userId;
    private String planCode;
    private Instant startedAt;
    private Instant endsAt;
    private String convertedTo;
    private Instant createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getPlanCode() { return planCode; }
    public void setPlanCode(String planCode) { this.planCode = planCode; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getEndsAt() { return endsAt; }
    public void setEndsAt(Instant endsAt) { this.endsAt = endsAt; }
    public String getConvertedTo() { return convertedTo; }
    public void setConvertedTo(String convertedTo) { this.convertedTo = convertedTo; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
