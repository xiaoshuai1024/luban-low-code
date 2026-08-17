package com.luban.backend.entity;

import java.time.Instant;

/**
 * 邮箱验证码实体；表 email_verifications。
 * 库存仅 code_hash（SHA-256 hex），明文码只存在于内存与邮件正文（敏感字段清单 §12）。
 * 重发 = 插新行，旧行自然作废（verify 只取最新一条）。
 */
public class EmailVerification {
    private String id;
    private String email;
    private String codeHash;
    private int attempts;
    private Instant expiresAt;
    private Instant consumedAt;
    private Instant createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getCodeHash() { return codeHash; }
    public void setCodeHash(String codeHash) { this.codeHash = codeHash; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getConsumedAt() { return consumedAt; }
    public void setConsumedAt(Instant consumedAt) { this.consumedAt = consumedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
