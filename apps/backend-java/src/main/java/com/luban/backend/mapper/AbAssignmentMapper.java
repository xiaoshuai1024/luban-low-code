package com.luban.backend.mapper;

import com.luban.backend.entity.AbAssignment;
import org.apache.ibatis.annotations.*;

/**
 * AB 分桶 Mapper（MyBatis 注解）。uk(experiment_id, visitor_id) 是一致性哈希落库保障：
 * 先查后插，insert 撞唯一键时重查既有分桶收敛（同 LeadService uk_form_dedup 模式）。
 */
@Mapper
public interface AbAssignmentMapper {

    String COLS = "id, experiment_id, visitor_id, variant_id, assigned_at";

    @Insert("INSERT INTO ab_assignments (id, experiment_id, visitor_id, variant_id, assigned_at) "
            + "VALUES (#{id}, #{experimentId}, #{visitorId}, #{variantId}, #{assignedAt})")
    int insert(AbAssignment assignment);

    /** 一致性查询：同 (experiment, visitor) 的既有分桶。 */
    @Select("SELECT " + COLS + " FROM ab_assignments WHERE experiment_id = #{experimentId} AND visitor_id = #{visitorId}")
    AbAssignment getByExperimentAndVisitor(@Param("experimentId") String experimentId,
                                           @Param("visitorId") String visitorId);
}
