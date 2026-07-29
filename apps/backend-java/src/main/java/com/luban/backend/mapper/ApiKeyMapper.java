package com.luban.backend.mapper;

import com.luban.backend.entity.ApiKey;
import org.apache.ibatis.annotations.*;

import java.time.Instant;
import java.util.List;

@Mapper
public interface ApiKeyMapper {

    @Insert("INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, status, last_used_at, expires_at, created_at, updated_at) " +
            "VALUES (#{id}, #{userId}, #{name}, #{keyHash}, #{keyPrefix}, #{status}, #{lastUsedAt}, #{expiresAt}, #{createdAt}, #{updatedAt})")
    int insert(ApiKey apiKey);

    @Select("SELECT id, user_id, name, key_hash, key_prefix, status, last_used_at, expires_at, created_at, updated_at " +
            "FROM api_keys WHERE user_id = #{userId} ORDER BY created_at DESC")
    List<ApiKey> findByUserId(String userId);

    @Select("SELECT id, user_id, name, key_hash, key_prefix, status, last_used_at, expires_at, created_at, updated_at " +
            "FROM api_keys WHERE id = #{id}")
    ApiKey findById(String id);

    @Select("SELECT id, user_id, name, key_hash, key_prefix, status, last_used_at, expires_at, created_at, updated_at " +
            "FROM api_keys WHERE key_hash = #{keyHash}")
    ApiKey findByKeyHash(String keyHash);

    @Select("SELECT id, user_id, name, key_hash, key_prefix, status, last_used_at, expires_at, created_at, updated_at " +
            "FROM api_keys WHERE key_prefix = #{prefix} AND status = 'active'")
    List<ApiKey> findActiveByPrefix(@Param("prefix") String prefix);

    @Update("UPDATE api_keys SET last_used_at = #{lastUsedAt} WHERE id = #{id}")
    int updateLastUsedAt(@Param("id") String id, @Param("lastUsedAt") Instant lastUsedAt);

    @Update("UPDATE api_keys SET status = #{status}, updated_at = #{updatedAt} WHERE id = #{id}")
    int updateStatus(@Param("id") String id, @Param("status") String status, @Param("updatedAt") Instant updatedAt);

    @Delete("DELETE FROM api_keys WHERE id = #{id}")
    int deleteById(String id);
}
