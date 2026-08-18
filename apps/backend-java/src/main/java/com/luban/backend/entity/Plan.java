package com.luban.backend.entity;

/**
 * 套餐实体；表 plans（seed 三档全 0 元；e2e-tiny hidden fixture 由 E2EBillingPlanBootstrap 注入）。
 * price_monthly 单位为分（BIGINT）；quota_* = 0 表示不限（quota_visits 本期全 0）。
 */
public class Plan {
    private String planCode;
    private String name;
    private String status;
    private long priceMonthly;
    private int quotaLeads;
    private int quotaPages;
    private int quotaVisits;
    private String gatesJson;
    private int trialDays;
    private int sortOrder;

    public String getPlanCode() { return planCode; }
    public void setPlanCode(String planCode) { this.planCode = planCode; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public long getPriceMonthly() { return priceMonthly; }
    public void setPriceMonthly(long priceMonthly) { this.priceMonthly = priceMonthly; }
    public int getQuotaLeads() { return quotaLeads; }
    public void setQuotaLeads(int quotaLeads) { this.quotaLeads = quotaLeads; }
    public int getQuotaPages() { return quotaPages; }
    public void setQuotaPages(int quotaPages) { this.quotaPages = quotaPages; }
    public int getQuotaVisits() { return quotaVisits; }
    public void setQuotaVisits(int quotaVisits) { this.quotaVisits = quotaVisits; }
    public String getGatesJson() { return gatesJson; }
    public void setGatesJson(String gatesJson) { this.gatesJson = gatesJson; }
    public int getTrialDays() { return trialDays; }
    public void setTrialDays(int trialDays) { this.trialDays = trialDays; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
