package com.luban.backend.dto;

/** GET /billing/usage?period= 响应（period 为 "yyyy-MM"）。 */
public record UsageResponse(String period, long leads, long pages, long visits) {}
