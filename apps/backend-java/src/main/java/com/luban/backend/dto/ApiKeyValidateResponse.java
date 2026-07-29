package com.luban.backend.dto;

/**
 * Response for POST /auth/api-key/validate.
 */
public record ApiKeyValidateResponse(
    String userId,
    String username,
    String role
) {}
