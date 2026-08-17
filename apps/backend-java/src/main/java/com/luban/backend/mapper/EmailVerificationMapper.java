package com.luban.backend.mapper;

import com.luban.backend.entity.EmailVerification;
import org.apache.ibatis.annotations.*;

import java.time.Instant;

@Mapper
public interface EmailVerificationMapper {

    @Select("SELECT id, email, code_hash, attempts, expires_at, consumed_at, created_at " +
            "FROM email_verifications WHERE email = #{email} ORDER BY created_at DESC LIMIT 1")
    EmailVerification findLatestByEmail(String email);

    /** 当日（UTC 0 点起）发送次数，支撑每邮箱日限。 */
    @Select("SELECT COUNT(1) FROM email_verifications WHERE email = #{email} AND created_at >= #{since}")
    long countCreatedSince(@Param("email") String email, @Param("since") Instant since);

    @Insert("INSERT INTO email_verifications (id, email, code_hash, attempts, expires_at, consumed_at, created_at) " +
            "VALUES (#{id}, #{email}, #{codeHash}, #{attempts}, #{expiresAt}, #{consumedAt}, #{createdAt})")
    int insert(EmailVerification verification);

    @Update("UPDATE email_verifications SET attempts = #{attempts} WHERE id = #{id}")
    int updateAttempts(@Param("id") String id, @Param("attempts") int attempts);

    @Update("UPDATE email_verifications SET consumed_at = #{consumedAt} WHERE id = #{id} AND consumed_at IS NULL")
    int markConsumed(@Param("id") String id, @Param("consumedAt") Instant consumedAt);
}
