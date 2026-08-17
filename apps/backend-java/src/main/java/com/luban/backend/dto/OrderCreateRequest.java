package com.luban.backend.dto;

import jakarta.validation.constraints.NotBlank;

/** POST /billing/orders 请求体（向导/billing 页换档主路径）。 */
public record OrderCreateRequest(@NotBlank String planCode) {}
