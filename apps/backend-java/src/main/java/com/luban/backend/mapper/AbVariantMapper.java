package com.luban.backend.mapper;

import com.luban.backend.entity.AbVariant;
import org.apache.ibatis.annotations.*;

import java.util.List;

/**
 * AB 变体 Mapper（MyBatis 注解）。排序固定 created_at,id —— 权重区间遍历需确定性顺序。
 */
@Mapper
public interface AbVariantMapper {

    String COLS = "id, experiment_id, variant_key, weight, schema_json, created_at";

    @Insert("INSERT INTO ab_variants (id, experiment_id, variant_key, weight, schema_json, created_at) "
            + "VALUES (#{id}, #{experimentId}, #{variantKey}, #{weight}, #{schemaJson}, #{createdAt})")
    int insert(AbVariant variant);

    /** 按实验取全部变体（确定性顺序：创建顺序，id 兜底并列）。 */
    @Select("SELECT " + COLS + " FROM ab_variants WHERE experiment_id = #{experimentId} "
            + "ORDER BY created_at ASC, id ASC")
    List<AbVariant> listByExperimentId(@Param("experimentId") String experimentId);

    @Select("SELECT " + COLS + " FROM ab_variants WHERE id = #{id}")
    AbVariant getById(@Param("id") String id);
}
