package com.luban.backend.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;

public record ApiKeyCreateRequest(
    @NotBlank String name,
    Instant expiresAt
) {}
