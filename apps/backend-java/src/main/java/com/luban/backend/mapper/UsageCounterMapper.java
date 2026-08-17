package com.luban.backend.mapper;

import org.apache.ibatis.annotations.*;

import java.time.Instant;

/**
 * 用量计数 mapper（T-be-5）。累加采用「占位 + 条件 UPDATE」两步（判限与计数同语句原子，
 * 无先查后加的超放窗口）：
 *   1) INSERT IGNORE 预落 count=0 占位行（MySQL 原生；H2 MODE=MySQL 同样支持，
 *      由 contract/QuotaEnforcementIT 实测守护；撞 uk_usage 唯一键静默跳过）；
 *   2) quota>0 → UPDATE ... SET count=count+1 WHERE ... AND count < #{quota}（0 行=已超限）；
 *      quota=0（不限）→ 无条件累加。
 */
@Mapper
public interface UsageCounterMapper {

    @Select("SELECT count FROM usage_counters WHERE user_id = #{userId} AND period_month = #{periodMonth} AND metric = #{metric}")
    Long getCount(@Param("userId") String userId, @Param("periodMonth") String periodMonth, @Param("metric") String metric);

    /** 占位行：不存在则插 count=0（INSERT IGNORE 撞 uk_usage 静默跳过，MySQL / H2 MODE=MySQL）。 */
    @Insert("INSERT IGNORE INTO usage_counters (id, user_id, period_month, metric, count, created_at, updated_at) " +
            "VALUES (#{id}, #{userId}, #{periodMonth}, #{metric}, 0, #{now}, #{now})")
    int insertPlaceholder(@Param("id") String id, @Param("userId") String userId,
                          @Param("periodMonth") String periodMonth, @Param("metric") String metric,
                          @Param("now") Instant now);

    /** 条件累加（quota>0）：仅当未达配额才 +1；返回影响行数（0=已满，调用方抛 429）。 */
    @Update("UPDATE usage_counters SET count = count + 1, updated_at = #{now} " +
            "WHERE user_id = #{userId} AND period_month = #{periodMonth} AND metric = #{metric} AND count < #{quota}")
    int incrementIfBelowQuota(@Param("userId") String userId, @Param("periodMonth") String periodMonth,
                              @Param("metric") String metric, @Param("quota") long quota, @Param("now") Instant now);

    /** 无条件累加（quota=0 不限，仍计数供用量展示）。 */
    @Update("UPDATE usage_counters SET count = count + 1, updated_at = #{now} " +
            "WHERE user_id = #{userId} AND period_month = #{periodMonth} AND metric = #{metric}")
    int incrementUnconditional(@Param("userId") String userId, @Param("periodMonth") String periodMonth,
                               @Param("metric") String metric, @Param("now") Instant now);

    /** 回退一次累加（count > 0 守卫防负）：唯一键冲突收敛等未落库路径回退配额计数。 */
    @Update("UPDATE usage_counters SET count = count - 1, updated_at = #{now} " +
            "WHERE user_id = #{userId} AND period_month = #{periodMonth} AND metric = #{metric} AND count > 0")
    int decrement(@Param("userId") String userId, @Param("periodMonth") String periodMonth,
                  @Param("metric") String metric, @Param("now") Instant now);
}
