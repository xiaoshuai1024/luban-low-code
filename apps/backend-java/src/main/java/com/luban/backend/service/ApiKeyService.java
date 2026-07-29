package com.luban.backend.service;

import com.luban.backend.dto.ApiKeyCreateResponse;
import com.luban.backend.dto.ApiKeyResponse;
import com.luban.backend.entity.ApiKey;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.ApiKeyMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ApiKeyService {

    private static final String KEY_PREFIX_STR = "lb_key_";
    private static final int RANDOM_BYTES = 24; // 24 bytes -> 32 Base64 chars (no padding overlap)
    private static final char[] ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ApiKeyMapper apiKeyMapper;
    private final PasswordEncoder passwordEncoder;

    public ApiKeyService(ApiKeyMapper apiKeyMapper, PasswordEncoder passwordEncoder) {
        this.apiKeyMapper = apiKeyMapper;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Generate a new API key: prefix + 32 random alphanumeric chars.
     * The raw key is returned only in ApiKeyCreateResponse; only the BCrypt hash is stored.
     */
    public ApiKeyCreateResponse generateApiKey(String userId, String name, Instant expiresAt) {
        String randomPart = generateRandomString(32);
        String rawKey = KEY_PREFIX_STR + randomPart;
        String keyHash = passwordEncoder.encode(rawKey);
        String keyPrefix = rawKey.substring(0, 8); // first 8 chars for DB lookup hint

        Instant now = Instant.now();
        ApiKey k = new ApiKey();
        k.setId(UUID.randomUUID().toString());
        k.setUserId(userId);
        k.setName(name);
        k.setKeyHash(keyHash);
        k.setKeyPrefix(keyPrefix);
        k.setStatus("active");
        k.setLastUsedAt(null);
        k.setExpiresAt(expiresAt);
        k.setCreatedAt(now);
        k.setUpdatedAt(now);

        apiKeyMapper.insert(k);
        return ApiKeyCreateResponse.fromEntity(k, rawKey);
    }

    /**
     * Validate a raw API key string. Returns the userId if valid.
     * Steps: extract prefix -> find active candidates -> BCrypt.matches -> update last_used_at.
     */
    public String validateApiKey(String rawKey) {
        if (rawKey == null || rawKey.length() < 8) {
            throw BusinessException.invalidArgument("invalid API key");
        }
        String prefix = rawKey.substring(0, 8);
        List<ApiKey> candidates = apiKeyMapper.findActiveByPrefix(prefix);
        if (candidates.isEmpty()) {
            throw BusinessException.invalidArgument("invalid API key");
        }
        for (ApiKey k : candidates) {
            if (passwordEncoder.matches(rawKey, k.getKeyHash())) {
                // Check expiry
                if (k.getExpiresAt() != null && Instant.now().isAfter(k.getExpiresAt())) {
                    apiKeyMapper.updateStatus(k.getId(), "expired", Instant.now());
                    throw BusinessException.invalidArgument("API key expired");
                }
                // Update last_used_at
                apiKeyMapper.updateLastUsedAt(k.getId(), Instant.now());
                return k.getUserId();
            }
        }
        throw BusinessException.invalidArgument("invalid API key");
    }

    /**
     * List all API keys for a user (without key_hash).
     */
    public List<ApiKeyResponse> listByUserId(String userId) {
        return apiKeyMapper.findByUserId(userId)
                .stream()
                .map(ApiKeyResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Revoke an API key by id. Only the owner can revoke.
     */
    public void revokeApiKey(String id, String userId) {
        ApiKey k = apiKeyMapper.findById(id);
        if (k == null) {
            throw BusinessException.invalidArgument("API key not found");
        }
        if (!k.getUserId().equals(userId)) {
            throw BusinessException.permissionDenied();
        }
        if (!"active".equals(k.getStatus())) {
            throw BusinessException.invalidArgument("API key already " + k.getStatus());
        }
        apiKeyMapper.updateStatus(id, "revoked", Instant.now());
    }

    private static String generateRandomString(int length) {
        char[] buf = new char[length];
        for (int i = 0; i < length; i++) {
            buf[i] = ALPHANUMERIC[RANDOM.nextInt(ALPHANUMERIC.length)];
        }
        return new String(buf);
    }
}
