package com.luban.backend.entity;

import java.time.Instant;

/**
 * User entity; table users. password not exposed in API.
 */
public class User {
    private String id;
    private String username;
    /** 注册邮箱（signup-billing-onboarding；存量行为 NULL，登录不受影响） */
    private String email;
    /** 邮箱验证通过时间（status=active 且非空 = 已验证） */
    private Instant emailVerifiedAt;
    private String name;
    private String role;
    private String status;
    private String password;
    private Instant createdAt;
    private Instant updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public Instant getEmailVerifiedAt() { return emailVerifiedAt; }
    public void setEmailVerifiedAt(Instant emailVerifiedAt) { this.emailVerifiedAt = emailVerifiedAt; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
