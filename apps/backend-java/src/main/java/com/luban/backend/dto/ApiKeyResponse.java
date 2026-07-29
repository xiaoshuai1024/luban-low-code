package com.luban.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.Instant;

/**
 * API key in list / get responses. key_hash is never exposed.
 */
public record ApiKeyResponse(
    String id,
    String userId,
    String name,
    String keyPrefix,
    String status,
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant lastUsedAt,
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant expiresAt,
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant createdAt,
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant updatedAt
) {
    public static ApiKeyResponse fromEntity(com.luban.backend.entity.ApiKey k) {
        if (k == null) return null;
        return new ApiKeyResponse(
            k.getId(),
            k.getUserId(),
            k.getName(),
            k.getKeyPrefix(),
            k.getStatus(),
            k.getLastUsedAt(),
            k.getExpiresAt(),
            k.getCreatedAt(),
            k.getUpdatedAt()
        );
    }
}
