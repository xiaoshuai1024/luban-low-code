package com.luban.backend.mapper;

import com.luban.backend.entity.Lead;
import org.apache.ibatis.annotations.*;

import java.time.Instant;
import java.util.List;

/**
 * Lead 线索 Mapper（MyBatis 注解，含去重查询、分页列表、状态更新）。
 */
@Mapper
public interface LeadMapper {

    String COLS = "id, site_id, form_id, page_id, channel_id, contact_json, utm_json, status, "
            + "assignee_id, dedup_hash, source_ip, visitor_id, converted_at, created_at, updated_at";

    @Insert("INSERT INTO leads (id, site_id, form_id, page_id, channel_id, contact_json, utm_json, status, "
            + "assignee_id, dedup_hash, source_ip, visitor_id, converted_at, created_at, updated_at) "
            + "VALUES (#{id}, #{siteId}, #{formId}, #{pageId}, #{channelId}, #{contactJson}, #{utmJson}, #{status}, "
            + "#{assigneeId}, #{dedupHash}, #{sourceIp}, #{visitorId}, #{convertedAt}, #{createdAt}, #{updatedAt})")
    int insert(Lead lead);

    @Select("SELECT " + COLS + " FROM leads WHERE id = #{id} AND site_id = #{siteId}")
    Lead getByIdAndSiteId(@Param("id") String id, @Param("siteId") String siteId);

    /** 去重查询：窗口内同 form + dedup_hash 的线索数。threshold 由调用方算（跨 H2/MySQL 兼容）。 */
    @Select("SELECT COUNT(*) FROM leads WHERE form_id = #{formId} AND dedup_hash = #{hash} "
            + "AND created_at >= #{threshold}")
    int countByFormHashInWindow(@Param("formId") String formId, @Param("hash") String hash,
                                @Param("threshold") Instant threshold);

    @Select("<script>"
            + "SELECT " + COLS + " FROM leads WHERE site_id = #{siteId}"
            + "<if test='status != null and status != \"\"'> AND status = #{status}</if>"
            + "<if test='formId != null and formId != \"\"'> AND form_id = #{formId}</if>"
            + "<if test='assigneeId != null and assigneeId != \"\"'> AND assignee_id = #{assigneeId}</if>"
            + " ORDER BY created_at DESC LIMIT #{offset}, #{limit}"
            + "</script>")
    List<Lead> listByQuery(@Param("siteId") String siteId,
                           @Param("status") String status,
                           @Param("formId") String formId,
                           @Param("assigneeId") String assigneeId,
                           @Param("offset") int offset,
                           @Param("limit") int limit);

    @Select("<script>"
            + "SELECT COUNT(*) FROM leads WHERE site_id = #{siteId}"
            + "<if test='status != null and status != \"\"'> AND status = #{status}</if>"
            + "<if test='formId != null and formId != \"\"'> AND form_id = #{formId}</if>"
            + "<if test='assigneeId != null and assigneeId != \"\"'> AND assignee_id = #{assigneeId}</if>"
            + "</script>")
    int countByQuery(@Param("siteId") String siteId,
                     @Param("status") String status,
                     @Param("formId") String formId,
                     @Param("assigneeId") String assigneeId);

    @Update("UPDATE leads SET status = #{status}, assignee_id = #{assigneeId}, "
            + "converted_at = #{convertedAt}, updated_at = #{updatedAt} "
            + "WHERE id = #{id} AND site_id = #{siteId}")
    int updateStatus(@Param("id") String id, @Param("siteId") String siteId,
                     @Param("status") String status, @Param("assigneeId") String assigneeId,
                     @Param("convertedAt") Instant convertedAt, @Param("updatedAt") Instant updatedAt);

    /** MERGE 去重：取窗口内同 form + dedup_hash 的最新一条线索（uk_form_dedup 全局唯一保证命中）。 */
    @Select("SELECT " + COLS + " FROM leads WHERE form_id = #{formId} AND dedup_hash = #{hash} "
            + "AND created_at >= #{threshold} ORDER BY created_at DESC LIMIT 1")
    Lead findLatestByFormHashInWindow(@Param("formId") String formId, @Param("hash") String hash,
                                      @Param("threshold") Instant threshold);

    /** MERGE 去重：合并 contact 后按 form + dedup_hash 更新（乐观锁 updated_at；影响 0 行=并发冲突）。 */
    @Update("UPDATE leads SET contact_json = #{contactJson}, updated_at = #{newUpdatedAt} "
            + "WHERE form_id = #{formId} AND dedup_hash = #{hash} AND updated_at = #{expectedUpdatedAt}")
    int updateContactByDedup(@Param("formId") String formId, @Param("hash") String hash,
                             @Param("contactJson") String contactJson,
                             @Param("expectedUpdatedAt") Instant expectedUpdatedAt,
                             @Param("newUpdatedAt") Instant newUpdatedAt);

    @Select("SELECT " + COLS + " FROM leads WHERE site_id = #{siteId} ORDER BY created_at DESC")
    List<Lead> listAllForExport(@Param("siteId") String siteId);

    /** V2 级联删除：删站点时先清 leads */
    @Delete("DELETE FROM leads WHERE site_id = #{siteId}")
    int deleteBySiteId(@Param("siteId") String siteId);
}
