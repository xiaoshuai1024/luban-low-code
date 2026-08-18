package com.luban.backend.mapper;

import com.luban.backend.entity.FeatureGate;
import org.apache.ibatis.annotations.*;

import java.time.Instant;
import java.util.List;

/**
 * FeatureGate mapper：读多写少，写走单语句 upsert。
 * ON DUPLICATE KEY UPDATE 在 MySQL 原生支持；H2 MODE=MySQL 同样支持
 * （先例：UsageCounterMapper 的 INSERT IGNORE，由 FeatureGateContractTest 实测守护）。
 */
@Mapper
public interface FeatureGateMapper {

    @Select("SELECT * FROM feature_gates WHERE site_id = #{siteId} ORDER BY gate_key")
    List<FeatureGate> listBySite(@Param("siteId") String siteId);

    @Select("SELECT * FROM feature_gates WHERE site_id = #{siteId} AND gate_key = #{gateKey}")
    FeatureGate getBySiteAndKey(@Param("siteId") String siteId, @Param("gateKey") String gateKey);

    /**
     * upsert：撞 uk(site_id, gate_key) 转 UPDATE（enabled/updated_at 刷新，id/created_at 保留原值）。
     * enabled 直接取参数（不用 VALUES() 函数——MySQL 8.0.20 起标记废弃且 H2 兼容性差）。
     *
     * @return 1=新插行，2=更新行（MySQL ON DUPLICATE KEY 语义），0=未变更
     */
    @Insert("INSERT INTO feature_gates (id, site_id, gate_key, enabled, created_at, updated_at) " +
            "VALUES (#{id}, #{siteId}, #{gateKey}, #{enabled}, #{now}, #{now}) " +
            "ON DUPLICATE KEY UPDATE enabled = #{enabled}, updated_at = #{now}")
    int upsert(@Param("id") String id, @Param("siteId") String siteId, @Param("gateKey") String gateKey,
               @Param("enabled") boolean enabled, @Param("now") Instant now);
}
