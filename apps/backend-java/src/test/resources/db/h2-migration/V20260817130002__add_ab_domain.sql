-- H2 (MySQL compatibility mode) variant of V20260817000002__add_ab_domain.sql
--
-- 转换惯例（对齐既有 h2-migration 变体）：
--   - DATETIME(3) → TIMESTAMP；JSON → CLOB（保 raw text 往返）
--   - 删 ENGINE=InnoDB / DEFAULT CHARSET
--   - 内联 INDEX → 独立 CREATE INDEX；UNIQUE KEY → CONSTRAINT ... UNIQUE

CREATE TABLE ab_experiments (
    id         VARCHAR(36)  PRIMARY KEY,
    site_id    VARCHAR(36)  NOT NULL,
    page_id    VARCHAR(36)  NULL,
    name       VARCHAR(128) NOT NULL,
    status     VARCHAR(16)  NOT NULL DEFAULT 'running',
    started_at TIMESTAMP    NOT NULL,
    ended_at   TIMESTAMP    NULL,
    created_at TIMESTAMP    NOT NULL,
    updated_at TIMESTAMP    NOT NULL
);

CREATE INDEX idx_abe_site ON ab_experiments (site_id);
CREATE INDEX idx_abe_page_status ON ab_experiments (page_id, status);

CREATE TABLE ab_variants (
    id            VARCHAR(36) PRIMARY KEY,
    experiment_id VARCHAR(36) NOT NULL,
    variant_key   VARCHAR(64) NOT NULL,
    weight        INT         NOT NULL DEFAULT 50,
    schema_json   CLOB        NULL,
    created_at    TIMESTAMP   NOT NULL,
    CONSTRAINT fk_abv_exp FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id) ON DELETE CASCADE,
    CONSTRAINT uk_abv_exp_key UNIQUE (experiment_id, variant_key)
);

CREATE TABLE ab_assignments (
    id            VARCHAR(36)  PRIMARY KEY,
    experiment_id VARCHAR(36)  NOT NULL,
    visitor_id    VARCHAR(128) NOT NULL,
    variant_id    VARCHAR(36)  NOT NULL,
    assigned_at   TIMESTAMP    NOT NULL,
    CONSTRAINT fk_aba_exp FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id) ON DELETE CASCADE,
    CONSTRAINT fk_aba_var FOREIGN KEY (variant_id) REFERENCES ab_variants(id),
    CONSTRAINT uk_aba_exp_visitor UNIQUE (experiment_id, visitor_id)
);
