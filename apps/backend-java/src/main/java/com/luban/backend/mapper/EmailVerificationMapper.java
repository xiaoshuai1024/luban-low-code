package com.luban.backend.mapper;

import com.luban.backend.entity.EmailVerification;
import org.apache.ibatis.annotations.*;

import java.time.Instant;

@Mapper
public interface EmailVerificationMapper {

    /** 尝试上限（EmailVerificationService.MAX_ATTEMPTS 同源，供下方 SQL 原子守卫引用）。 */
    int MAX_ATTEMPTS = 5;

    @Select("SELECT id, email, code_hash, attempts, expires_at, consumed_at, created_at " +
            "FROM email_verifications WHERE email = #{email} ORDER BY created_at DESC LIMIT 1")
    EmailVerification findLatestByEmail(String email);

    /** 当日（UTC 0 点起）发送次数，支撑每邮箱日限。 */
    @Select("SELECT COUNT(1) FROM email_verifications WHERE email = #{email} AND created_at >= #{since}")
    long countCreatedSince(@Param("email") String email, @Param("since") Instant since);

    @Insert("INSERT INTO email_verifications (id, email, code_hash, attempts, expires_at, consumed_at, created_at) " +
            "VALUES (#{id}, #{email}, #{codeHash}, #{attempts}, #{expiresAt}, #{consumedAt}, #{createdAt})")
    int insert(EmailVerification verification);

    /** 原子自增失败计数：attempts 已达上限（或行不存在/被替换）时影响行数=0，由调用方回读判定 EXCEEDED。 */
    @Update("UPDATE email_verifications SET attempts = attempts + 1 " +
            "WHERE id = #{id} AND attempts < " + MAX_ATTEMPTS)
    int incrementAttempts(@Param("id") String id);

    /** 发信失败回滚验证码行：冷却/日限只对成功发信计数。 */
    @Delete("DELETE FROM email_verifications WHERE id = #{id}")
    int deleteById(@Param("id") String id);

    @Update("UPDATE email_verifications SET consumed_at = #{consumedAt} WHERE id = #{id} AND consumed_at IS NULL")
    int markConsumed(@Param("id") String id, @Param("consumedAt") Instant consumedAt);
}
