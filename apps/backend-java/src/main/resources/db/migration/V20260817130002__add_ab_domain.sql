-- AB 实验域（wire-e2e-feature-gaps design D2：最小可测分桶）
-- 三表：ab_experiments / ab_variants / ab_assignments
--   - status 用 VARCHAR 存 'running'/'ended'（对齐库内既有 status 列惯例，ENUM 由应用层校验）
--   - uk_aba_exp_visitor 支撑「同 (experiment, visitor) 稳定分桶」：先查后插 + 撞键重查收敛
--   - 站点/页面不加外键：site 删除流程（SiteService）未级联 ab 表，加 FK 反而使删站 500

-- 1) 实验（page 维度；page_id 允许 NULL 供 site 级实验预留）
CREATE TABLE ab_experiments (
    id         VARCHAR(36)  PRIMARY KEY,
    site_id    VARCHAR(36)  NOT NULL,
    page_id    VARCHAR(36)  NULL,
    name       VARCHAR(128) NOT NULL,
    status     VARCHAR(16)  NOT NULL DEFAULT 'running',
    started_at DATETIME(3)  NOT NULL,
    ended_at   DATETIME(3)  NULL,
    created_at DATETIME(3)  NOT NULL,
    updated_at DATETIME(3)  NOT NULL,
    INDEX idx_abe_site (site_id),
    INDEX idx_abe_page_status (page_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) 变体（variant_key 唯一；schema_json 可空——对照组常为空即沿用原页面）
CREATE TABLE ab_variants (
    id            VARCHAR(36) PRIMARY KEY,
    experiment_id VARCHAR(36) NOT NULL,
    variant_key   VARCHAR(64) NOT NULL,
    weight        INT         NOT NULL DEFAULT 50,
    schema_json   JSON        NULL,
    created_at    DATETIME(3) NOT NULL,
    CONSTRAINT fk_abv_exp FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id) ON DELETE CASCADE,
    UNIQUE KEY uk_abv_exp_key (experiment_id, variant_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) 分桶记录（唯一键 = 一致性落库保障）
CREATE TABLE ab_assignments (
    id            VARCHAR(36)  PRIMARY KEY,
    experiment_id VARCHAR(36)  NOT NULL,
    visitor_id    VARCHAR(128) NOT NULL,
    variant_id    VARCHAR(36)  NOT NULL,
    assigned_at   DATETIME(3)  NOT NULL,
    CONSTRAINT fk_aba_exp FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id) ON DELETE CASCADE,
    CONSTRAINT fk_aba_var FOREIGN KEY (variant_id) REFERENCES ab_variants(id),
    UNIQUE KEY uk_aba_exp_visitor (experiment_id, visitor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
