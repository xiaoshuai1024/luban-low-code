package com.luban.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * POST /auth/register 成功响应（201）。
 * devCode 仅在 MAIL_DEV_ECHO=true（dev/e2e env）时回显；生产恒为 null 且不出现在 JSON。
 */
public record RegisterResponse(
    String username,
    String emailMasked,
    @JsonInclude(JsonInclude.Include.NON_NULL) String devCode
) {}
