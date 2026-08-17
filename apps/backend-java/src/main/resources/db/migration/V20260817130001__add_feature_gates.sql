-- FeatureGate 域（wire-e2e-feature-gaps D1）：site 级功能开关，读多写少。
-- fail-open 语义：无记录 = enabled（不预置任何行），唯一键 (site_id, gate_key) 支撑 upsert。
-- 注：不建 site_id → sites 的外键（pages/forms/leads 有 FK 且由 SiteService.delete 显式级联清理；
-- feature_gates 不在删除链路上，保留 FK 会使配置过 gate 的站点无法删除，需跨域改 SiteService——
-- 孤儿 gate 行无害：site 删除后不可达，fail-open 恒 true）。
CREATE TABLE feature_gates (
    id         VARCHAR(36)  PRIMARY KEY,
    site_id    VARCHAR(36)  NOT NULL,
    gate_key   VARCHAR(128) NOT NULL,
    enabled    TINYINT      NOT NULL DEFAULT 1,
    created_at DATETIME(3)  NOT NULL,
    updated_at DATETIME(3)  NOT NULL,
    UNIQUE KEY uk_feature_gates_site_key (site_id, gate_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
