package com.luban.backend.dto;

import jakarta.validation.constraints.NotBlank;

/** POST /billing/subscribe 请求体（v02 契约别名；主路径走 POST /billing/orders）。 */
public record SubscribeRequest(@NotBlank String planCode) {}
