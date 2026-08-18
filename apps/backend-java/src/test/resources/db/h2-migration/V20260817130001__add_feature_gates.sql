-- H2 variant of V20260817000001__add_feature_gates.sql
-- 转换惯例（对齐 V20260729000001 H2 变体）：DATETIME(3) → TIMESTAMP，
-- 删 ENGINE=InnoDB / DEFAULT CHARSET，UNIQUE KEY → CONSTRAINT ... UNIQUE。
-- ON DUPLICATE KEY UPDATE 的 upsert 由 FeatureGateMapper 使用，H2 MODE=MySQL 支持
-- （同 UsageCounterMapper 的 INSERT IGNORE 先例，契约测试实测守护）。
CREATE TABLE feature_gates (
    id         VARCHAR(36)  PRIMARY KEY,
    site_id    VARCHAR(36)  NOT NULL,
    gate_key   VARCHAR(128) NOT NULL,
    enabled    TINYINT      NOT NULL DEFAULT 1,
    created_at TIMESTAMP    NOT NULL,
    updated_at TIMESTAMP    NOT NULL,
    CONSTRAINT uk_feature_gates_site_key UNIQUE (site_id, gate_key)
);
