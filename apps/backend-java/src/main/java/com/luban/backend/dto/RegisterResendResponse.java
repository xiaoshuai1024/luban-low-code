package com.luban.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/** POST /auth/register/resend 成功响应；devCode 仅 MAIL_DEV_ECHO env 下回显。 */
public record RegisterResendResponse(
    String emailMasked,
    @JsonInclude(JsonInclude.Include.NON_NULL) String devCode
) {}
