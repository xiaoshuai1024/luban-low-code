package com.luban.backend.service;

import com.luban.backend.entity.FeatureGate;
import com.luban.backend.exception.BusinessException;
import com.luban.backend.mapper.FeatureGateMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * FeatureGate 域服务（wire-e2e-feature-gaps D1）：
 *
 *   查询 fail-open —— 无记录 → enabled=true（未配置的功能不阻塞访客；
 *   内置默认 realtime_collab=true 靠该语义自然获得，不预置行）；
 *   配置 upsert —— 唯一键 (site_id, gate_key)，首配 INSERT、再配 UPDATE。
 */
@Service
public class FeatureGateService {

    /** 留资提交开关（e2e feature-gate spec 契约 key，关闭 → LEAD_DISABLED）。 */
    public static final String KEY_LEAD_CAPTURE = "lead_capture";

    private final FeatureGateMapper featureGateMapper;

    public FeatureGateService(FeatureGateMapper featureGateMapper) {
        this.featureGateMapper = featureGateMapper;
    }

    /**
     * gate 查询（fail-open）：无记录 → true。
     * siteId/gateKey 非法（空白）同样 fail-open（读路径不抛错，未上线功能不阻塞访客）。
     */
    public boolean isEnabled(String siteId, String gateKey) {
        if (siteId == null || siteId.isBlank() || gateKey == null || gateKey.isBlank()) {
            return true;
        }
        FeatureGate gate = featureGateMapper.getBySiteAndKey(siteId, gateKey);
        return gate == null || gate.isEnabled();
    }

    /** 管理端配置（upsert）。@return 落库后的 gate（回读，含 created/updated 时间戳）。 */
    @Transactional(rollbackFor = Exception.class)
    public FeatureGate setEnabled(String siteId, String gateKey, boolean enabled) {
        requireSiteId(siteId);
        if (gateKey == null || !gateKey.matches("^[A-Za-z0-9_-]{1,128}$")) {
            throw BusinessException.invalidArgument("key: 格式应为 1-128 位字母/数字/下划线/连字符");
        }
        Instant now = Instant.now();
        featureGateMapper.upsert(UUID.randomUUID().toString(), siteId.trim(), gateKey, enabled, now);
        FeatureGate saved = featureGateMapper.getBySiteAndKey(siteId.trim(), gateKey);
        if (saved == null) {
            // 理论不可达（upsert 同事务回读）；防御性抛错避免静默返回半状态
            throw new IllegalStateException("feature gate upsert 未生效: " + siteId + "/" + gateKey);
        }
        return saved;
    }

    /** 管理端列表：该 site 已配置的 gate（未配置的 key 不出现——fail-open 默认不占行）。 */
    public List<FeatureGate> listBySite(String siteId) {
        requireSiteId(siteId);
        return featureGateMapper.listBySite(siteId.trim());
    }

    private static void requireSiteId(String siteId) {
        if (siteId == null || siteId.isBlank()) {
            throw BusinessException.invalidArgument("siteId: 不能为空");
        }
    }
}
