package com.luban.backend.mapper;

import com.luban.backend.entity.TrialRecord;
import org.apache.ibatis.annotations.*;

@Mapper
public interface TrialRecordMapper {

    String COLS = "id, user_id, plan_code, started_at, ends_at, converted_to, created_at";

    /** 「某套餐首次试用」判定依据（uk_trial_user_plan 保证 ≤1）。 */
    @Select("SELECT COUNT(1) FROM trial_records WHERE user_id = #{userId} AND plan_code = #{planCode}")
    long countByUserAndPlan(@Param("userId") String userId, @Param("planCode") String planCode);

    @Select("SELECT " + COLS + " FROM trial_records WHERE user_id = #{userId} AND plan_code = #{planCode}")
    TrialRecord getByUserAndPlan(@Param("userId") String userId, @Param("planCode") String planCode);

    @Insert("INSERT INTO trial_records (id, user_id, plan_code, started_at, ends_at, converted_to, created_at) " +
            "VALUES (#{id}, #{userId}, #{planCode}, #{startedAt}, #{endsAt}, #{convertedTo}, #{createdAt})")
    int insert(TrialRecord record);

    /** 到期降级回填去向（幂等：仅未回填的记录会被更新）。 */
    @Update("UPDATE trial_records SET converted_to = #{convertedTo} WHERE user_id = #{userId} AND plan_code = #{planCode} AND converted_to IS NULL")
    int markConverted(@Param("userId") String userId, @Param("planCode") String planCode, @Param("convertedTo") String convertedTo);
}
