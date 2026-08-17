package com.luban.backend.dto;

import jakarta.validation.constraints.NotBlank;

/** POST /auth/register/verify 请求体（email 无记录同回 VERIFY_CODE_INVALID，防枚举）。 */
public record RegisterVerifyRequest(
    @NotBlank @jakarta.validation.constraints.Email String email,
    @NotBlank String code
) {}
