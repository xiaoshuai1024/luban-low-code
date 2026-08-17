package com.luban.backend.dto;

import jakarta.validation.constraints.NotBlank;

/** POST /auth/register/resend 请求体（旧码作废、TTL 重置；60s 冷却 + 每邮箱日限 10）。 */
public record RegisterResendRequest(
    @NotBlank @jakarta.validation.constraints.Email String email
) {}
