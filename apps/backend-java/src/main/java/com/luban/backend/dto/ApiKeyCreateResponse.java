package com.luban.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.Instant;

/**
 * Create response includes the full raw apiKey (shown only once).
 * The apiKey field is the unhashed secret the caller must store immediately.
 */
public record ApiKeyCreateResponse(
    String id,
    String userId,
    String name,
    String keyPrefix,
    String apiKey,
    String status,
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant expiresAt,
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant createdAt,
    @JsonFormat(shape = JsonFormat.Shape.STRING) Instant updatedAt
) {
    public static ApiKeyCreateResponse fromEntity(com.luban.backend.entity.ApiKey k, String rawApiKey) {
        if (k == null) return null;
        return new ApiKeyCreateResponse(
            k.getId(),
            k.getUserId(),
            k.getName(),
            k.getKeyPrefix(),
            rawApiKey,
            k.getStatus(),
            k.getExpiresAt(),
            k.getCreatedAt(),
            k.getUpdatedAt()
        );
    }
}
