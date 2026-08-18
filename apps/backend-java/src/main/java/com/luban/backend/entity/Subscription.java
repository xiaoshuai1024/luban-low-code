package com.luban.backend.entity;

import java.time.Instant;

/**
 * 订阅实体；表 subscriptions（user_id 主键，一人一条）。
 * status：active / trialing / expired；trialing 到期由 TrialDowngradeJob 降回 free/active。
 */
public class Subscription {
    private String userId;
    private String planCode;
    private String status;
    private Instant startedAt;
    private Instant expiresAt;
    private Instant trialStartedAt;
    private Instant trialEndsAt;
    private Instant createdAt;
    private Instant updatedAt;

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getPlanCode() { return planCode; }
    public void setPlanCode(String planCode) { this.planCode = planCode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getTrialStartedAt() { return trialStartedAt; }
    public void setTrialStartedAt(Instant trialStartedAt) { this.trialStartedAt = trialStartedAt; }
    public Instant getTrialEndsAt() { return trialEndsAt; }
    public void setTrialEndsAt(Instant trialEndsAt) { this.trialEndsAt = trialEndsAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
