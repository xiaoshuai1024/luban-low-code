package com.luban.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * POST /auth/register 请求体。
 * username 白名单格式在 RegisterService 服务层复检（错误文案可控行为一致）；
 * 密码强度（≥8 位含字母+数字）在服务层校验 → 400 WEAK_PASSWORD；
 * email 长度 ≤255 对齐 users.email 列宽（超长 400 而非落库 500）。
 */
public record RegisterRequest(
    @NotBlank @jakarta.validation.constraints.Pattern(regexp = "[a-z0-9_-]{3,32}",
        message = "3-32 位小写字母/数字/_/-") String username,
    @NotBlank @Email @Size(max = 255, message = "邮箱长度不能超过 255 字符") String email,
    @NotBlank String password
) {}
