package com.luban.backend.mapper;

import com.luban.backend.entity.Subscription;
import org.apache.ibatis.annotations.*;

import java.time.Instant;
import java.util.List;

@Mapper
public interface SubscriptionMapper {

    String COLS = "user_id, plan_code, status, started_at, expires_at, trial_started_at, trial_ends_at, created_at, updated_at";

    @Select("SELECT " + COLS + " FROM subscriptions WHERE user_id = #{userId}")
    Subscription getByUserId(String userId);

    /** 订阅写入串行化点：锁该用户行（OrderService 0 元下单幂等竞态防护；行不存在返回 null）。 */
    @Select("SELECT " + COLS + " FROM subscriptions WHERE user_id = #{userId} FOR UPDATE")
    Subscription selectForUpdate(@Param("userId") String userId);

    /** TrialDowngradeJob 扫描：trialing 且已到期。 */
    @Select("SELECT " + COLS + " FROM subscriptions WHERE status = 'trialing' AND trial_ends_at < #{now}")
    List<Subscription> listExpiredTrialing(@Param("now") Instant now);

    /** 首次插入（verify 激活 / 首次订阅）；已存在时受 user_id 主键约束，改走 update。 */
    @Insert("INSERT INTO subscriptions (user_id, plan_code, status, started_at, expires_at, trial_started_at, trial_ends_at, created_at, updated_at) " +
            "VALUES (#{userId}, #{planCode}, #{status}, #{startedAt}, #{expiresAt}, #{trialStartedAt}, #{trialEndsAt}, #{createdAt}, #{updatedAt})")
    int insert(Subscription subscription);

    /** 整行覆盖更新（换档）；未变化列由调用方按实体原值回填。 */
    @Update("UPDATE subscriptions SET plan_code = #{planCode}, status = #{status}, started_at = #{startedAt}, " +
            "expires_at = #{expiresAt}, trial_started_at = #{trialStartedAt}, trial_ends_at = #{trialEndsAt}, updated_at = #{updatedAt} " +
            "WHERE user_id = #{userId}")
    int update(Subscription subscription);

    /**
     * 守卫式降级（TrialDowngradeJob）：仅当仍为 trialing 且已到期才落 free/active，
     * 并清空 trial 残留字段（trial_started_at / trial_ends_at）。返回影响行数
     * （0=已被并发处理或状态已变，调用方据此跳过 trial_records 回填）。
     */
    @Update("UPDATE subscriptions SET plan_code = 'free', status = 'active', " +
            "trial_started_at = NULL, trial_ends_at = NULL, updated_at = #{now} " +
            "WHERE user_id = #{userId} AND status = 'trialing' AND trial_ends_at < #{now}")
    int guardDowngradeToFree(@Param("userId") String userId, @Param("now") Instant now);
}
