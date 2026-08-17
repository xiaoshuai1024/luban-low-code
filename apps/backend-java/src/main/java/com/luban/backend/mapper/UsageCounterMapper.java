package com.luban.backend.mapper;

import org.apache.ibatis.annotations.*;

import java.time.Instant;

/**
 * 用量计数 mapper（T-be-5）。upsert 采用 MySQL 原子语法
 * INSERT ... ON DUPLICATE KEY UPDATE count = count + 1（uk_usage 唯一键冲突即转累加）。
 * H2 MODE=MySQL 对该语法的兼容性由 contract/QuotaEnforcementIT 实测守护
 * （plan §9.3：不等价则退两步法——insert 捕获唯一冲突转 update，见 QuotaService 注释）。
 */
@Mapper
public interface UsageCounterMapper {

    @Select("SELECT count FROM usage_counters WHERE user_id = #{userId} AND period_month = #{periodMonth} AND metric = #{metric}")
    Long getCount(@Param("userId") String userId, @Param("periodMonth") String periodMonth, @Param("metric") String metric);

    @Insert("INSERT INTO usage_counters (id, user_id, period_month, metric, count, created_at, updated_at) " +
            "VALUES (#{id}, #{userId}, #{periodMonth}, #{metric}, 1, #{now}, #{now}) " +
            "ON DUPLICATE KEY UPDATE count = count + 1, updated_at = #{now}")
    int increment(@Param("id") String id, @Param("userId") String userId,
                  @Param("periodMonth") String periodMonth, @Param("metric") String metric,
                  @Param("now") Instant now);
}
