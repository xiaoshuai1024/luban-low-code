package com.luban.backend.entity;

import java.time.Instant;

/**
 * 用量计数实体；表 usage_counters（uk(user_id, period_month, metric) 支撑原子累加）。
 * period_month 为 "yyyy-MM"（UTC）；metric ∈ {leads, pages, visits}。
 */
public class UsageCounter {
    private String id;
    private String userId;
    private String periodMonth;
    private String metric;
    private long count;
    private Instant createdAt;
    private Instant updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getPeriodMonth() { return periodMonth; }
    public void setPeriodMonth(String periodMonth) { this.periodMonth = periodMonth; }
    public String getMetric() { return metric; }
    public void setMetric(String metric) { this.metric = metric; }
    public long getCount() { return count; }
    public void setCount(long count) { this.count = count; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
