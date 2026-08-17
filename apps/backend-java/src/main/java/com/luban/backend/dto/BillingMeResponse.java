package com.luban.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/** GET /billing/me 响应：当前订阅 + 当月用量 + 档位配额（无订阅回退 free+0）。 */
public record BillingMeResponse(
    String planCode,
    String planName,
    String status,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant trialEndsAt,
    Snapshot usage,
    Snapshot quota
) {
    /** 三指标快照（usage 与 quota 共用形态）。 */
    public record Snapshot(long leads, long pages, long visits) {}
}
