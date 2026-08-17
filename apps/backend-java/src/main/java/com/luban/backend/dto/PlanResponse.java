package com.luban.backend.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luban.backend.entity.Plan;

/** GET /billing/plans 裸数组元素（v02 契约 camelCase；priceMonthly 单位分）。 */
public record PlanResponse(
    String planCode,
    String name,
    long priceMonthly,
    int quotaLeads,
    int quotaPages,
    int quotaVisits,
    JsonNode gates,
    int trialDays
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static PlanResponse fromEntity(Plan p) {
        if (p == null) return null;
        return new PlanResponse(
            p.getPlanCode(),
            p.getName(),
            p.getPriceMonthly(),
            p.getQuotaLeads(),
            p.getQuotaPages(),
            p.getQuotaVisits(),
            parseJson(p.getGatesJson()),
            p.getTrialDays()
        );
    }

    private static JsonNode parseJson(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return MAPPER.readTree(raw);
        } catch (Exception ignored) {
            return null;
        }
    }
}
