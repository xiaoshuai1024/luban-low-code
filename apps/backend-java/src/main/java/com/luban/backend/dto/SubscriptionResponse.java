package com.luban.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.luban.backend.entity.Subscription;

import java.time.Instant;

/** 订阅载荷（/billing/me、/billing/subscribe、/billing/orders 响应共用；status: active/trialing/expired）。 */
public record SubscriptionResponse(
    String planCode,
    String planName,
    String status,
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant startedAt,
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant trialEndsAt
) {
    public static SubscriptionResponse fromEntity(Subscription s, String planName) {
        if (s == null) return null;
        return new SubscriptionResponse(s.getPlanCode(), planName, s.getStatus(), s.getStartedAt(), s.getTrialEndsAt());
    }
}
