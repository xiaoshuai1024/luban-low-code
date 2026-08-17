package com.luban.backend.dto;

/** POST /auth/register/verify 成功响应：user 载荷交 BFF signToken 组装 {token,user}。 */
public record RegisterVerifyResponse(UserResponse user) {}
