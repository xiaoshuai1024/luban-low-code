package com.luban.backend.mapper;

import com.luban.backend.entity.User;
import org.apache.ibatis.annotations.*;

import java.time.Instant;
import java.util.List;

@Mapper
public interface UserMapper {

    String COLS = "id, username, email, email_verified_at, name, role, status, password, created_at, updated_at";

    @Select("SELECT " + COLS + " FROM users WHERE username = #{username}")
    User findByUsername(String username);

    @Select("SELECT " + COLS + " FROM users WHERE email = #{email}")
    User findByEmail(String email);

    @Select("SELECT " + COLS + " FROM users WHERE id = #{id}")
    User getById(String id);

    @Select("SELECT " + COLS + " FROM users " +
            "WHERE (#{keyword} IS NULL OR #{keyword} = '' OR username LIKE CONCAT('%', #{keyword}, '%') OR name LIKE CONCAT('%', #{keyword}, '%')) " +
            "ORDER BY created_at DESC LIMIT #{size} OFFSET #{offset}")
    List<User> list(@Param("keyword") String keyword, @Param("offset") int offset, @Param("size") int size);

    @Select("SELECT COUNT(1) FROM users " +
            "WHERE (#{keyword} IS NULL OR #{keyword} = '' OR username LIKE CONCAT('%', #{keyword}, '%') OR name LIKE CONCAT('%', #{keyword}, '%'))")
    long count(@Param("keyword") String keyword);

    @Insert("INSERT INTO users (id, username, email, email_verified_at, name, role, status, password, created_at, updated_at) " +
            "VALUES (#{id}, #{username}, #{email}, #{emailVerifiedAt}, #{name}, #{role}, #{status}, #{password}, #{createdAt}, #{updatedAt})")
    int insert(User user);

    @Update("UPDATE users SET username=#{username}, name=#{name}, role=#{role}, status=#{status}, updated_at=#{updatedAt} WHERE id=#{id}")
    int update(User user);

    @Update("UPDATE users SET password=#{password}, updated_at=#{updatedAt} WHERE id=#{id}")
    int updatePassword(@Param("id") String id, @Param("password") String password, @Param("updatedAt") Instant updatedAt);

    @Update("UPDATE users SET status=#{status}, updated_at=#{updatedAt} WHERE id=#{id}")
    int updateStatus(@Param("id") String id, @Param("status") String status, @Param("updatedAt") Instant updatedAt);

    /** 注册验证通过：status→active + email_verified_at（单语句保证两列同落）。
     *  守卫 AND status='pending_verification'：active/disabled 一律不激活；影响行数=0 由调用方回读判状态给错。 */
    @Update("UPDATE users SET status = 'active', email_verified_at = #{verifiedAt}, updated_at = #{updatedAt} " +
            "WHERE id = #{id} AND status = 'pending_verification'")
    int verifyEmail(@Param("id") String id, @Param("verifiedAt") Instant verifiedAt, @Param("updatedAt") Instant updatedAt);
}
