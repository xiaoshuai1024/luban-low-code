package com.luban.backend.controller;

import com.luban.backend.auth.UserContext;
import com.luban.backend.dto.*;
import com.luban.backend.entity.User;
import com.luban.backend.mapper.UserMapper;
import com.luban.backend.service.ApiKeyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class ApiKeyController {

    private final ApiKeyService apiKeyService;
    private final UserMapper userMapper;

    public ApiKeyController(ApiKeyService apiKeyService, UserMapper userMapper) {
        this.apiKeyService = apiKeyService;
        this.userMapper = userMapper;
    }

    /**
     * POST /auth/api-key/validate
     * Validates an API key from the X-Api-Key header and returns user info.
     * This endpoint does NOT require authentication (whitelisted in AuthFilter).
     */
    @PostMapping("/auth/api-key/validate")
    public ResponseEntity<ApiKeyValidateResponse> validate(@RequestHeader("X-Api-Key") String apiKey) {
        String userId = apiKeyService.validateApiKey(apiKey);
        User user = userMapper.getById(userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiKeyValidateResponse(null, null, null));
        }
        return ResponseEntity.ok(new ApiKeyValidateResponse(
                user.getId(),
                user.getUsername(),
                user.getRole()
        ));
    }

    /**
     * GET /api-keys
     * List API keys for the current user (from X-User-ID header).
     */
    @GetMapping("/api-keys")
    public ResponseEntity<List<ApiKeyResponse>> list() {
        String userId = UserContext.getUserId();
        return ResponseEntity.ok(apiKeyService.listByUserId(userId));
    }

    /**
     * POST /api-keys
     * Create a new API key for the current user.
     */
    @PostMapping("/api-keys")
    public ResponseEntity<ApiKeyCreateResponse> create(@Valid @RequestBody ApiKeyCreateRequest req) {
        String userId = UserContext.getUserId();
        ApiKeyCreateResponse resp = apiKeyService.generateApiKey(userId, req.name(), req.expiresAt());
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    /**
     * PATCH /api-keys/{id}/revoke
     * Revoke an API key (owner only).
     */
    @PatchMapping("/api-keys/{id}/revoke")
    public ResponseEntity<Void> revoke(@PathVariable String id) {
        String userId = UserContext.getUserId();
        apiKeyService.revokeApiKey(id, userId);
        return ResponseEntity.noContent().build();
    }
}
