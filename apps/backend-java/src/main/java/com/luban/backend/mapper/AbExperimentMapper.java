package com.luban.backend.mapper;

import com.luban.backend.entity.AbExperiment;
import org.apache.ibatis.annotations.*;

import java.time.Instant;
import java.util.List;

/**
 * AB 实验 Mapper（MyBatis 注解）。
 */
@Mapper
public interface AbExperimentMapper {

    String COLS = "id, site_id, page_id, name, status, started_at, ended_at, created_at, updated_at";

    @Insert("INSERT INTO ab_experiments (id, site_id, page_id, name, status, started_at, ended_at, created_at, updated_at) "
            + "VALUES (#{id}, #{siteId}, #{pageId}, #{name}, #{status}, #{startedAt}, #{endedAt}, #{createdAt}, #{updatedAt})")
    int insert(AbExperiment experiment);

    @Select("SELECT " + COLS + " FROM ab_experiments WHERE id = #{id}")
    AbExperiment getById(@Param("id") String id);

    /** 管理端列表（按站点，新实验在前）。 */
    @Select("SELECT " + COLS + " FROM ab_experiments WHERE site_id = #{siteId} ORDER BY created_at DESC, id DESC")
    List<AbExperiment> listBySiteId(@Param("siteId") String siteId);

    /**
     * 公开分流的 page 维度解析：优先 running（同页多实验取最新启动），否则最新 ended
     * （ended 实验按 D2 返回 {variantId:null,status:'ended'} 而非 404；页面从未有实验才 404）。
     */
    @Select("SELECT " + COLS + " FROM ab_experiments WHERE page_id = #{pageId} "
            + "ORDER BY CASE WHEN status = 'running' THEN 0 ELSE 1 END, started_at DESC, created_at DESC LIMIT 1")
    AbExperiment resolveByPageId(@Param("pageId") String pageId);

    /** 结束实验：status → ended + ended_at（幂等：已 ended 不再覆盖 ended_at）。 */
    @Update("UPDATE ab_experiments SET status = 'ended', ended_at = #{endedAt}, updated_at = #{updatedAt} "
            + "WHERE id = #{id} AND status = 'running'")
    int end(@Param("id") String id, @Param("endedAt") Instant endedAt, @Param("updatedAt") Instant updatedAt);
}
