-- H2 variant of V20260620000001__add_forms_leads.sql
-- (JSON → CLOB, DATETIME(3) → TIMESTAMP, drop ENGINE/charset, MySQL KEY → CREATE INDEX;
--  same as the init_schema H2 adaptation notes).
-- 此前 forms/leads 仅靠已废弃的 src/main/resources/schema.sql（embedded 模式自动执行）兜底建表，
-- 本迁移补齐后测试 schema 完全由 Flyway h2-migration 管理。

CREATE TABLE forms (
    id                  VARCHAR(36)  PRIMARY KEY,
    site_id             VARCHAR(36)  NOT NULL,
    page_id             VARCHAR(36)  NOT NULL,
    name                VARCHAR(255) NOT NULL,
    field_schema_json   CLOB         NOT NULL,
    submit_config_json  CLOB         NOT NULL,
    dedup_keys_json     CLOB,
    dedup_window        INT          NOT NULL DEFAULT 86400,
    dedup_policy        VARCHAR(16)  NOT NULL DEFAULT 'reject',
    anti_spam_json      CLOB,
    status              VARCHAR(32)  NOT NULL DEFAULT 'active',
    created_at          TIMESTAMP NOT NULL,
    updated_at          TIMESTAMP NOT NULL,
    CONSTRAINT fk_forms_site FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT fk_forms_page FOREIGN KEY (page_id) REFERENCES pages(id)
);

CREATE INDEX idx_forms_page ON forms (page_id);

CREATE TABLE leads (
    id            VARCHAR(36) PRIMARY KEY,
    site_id       VARCHAR(36) NOT NULL,
    form_id       VARCHAR(36) NOT NULL,
    page_id       VARCHAR(36) NOT NULL,
    channel_id    VARCHAR(36),
    contact_json  CLOB         NOT NULL,
    utm_json      CLOB,
    status        VARCHAR(16) NOT NULL DEFAULT 'new',
    assignee_id   VARCHAR(36),
    dedup_hash    VARCHAR(64) NOT NULL,
    source_ip     VARCHAR(64),
    visitor_id    VARCHAR(64),
    converted_at  TIMESTAMP,
    created_at    TIMESTAMP NOT NULL,
    updated_at    TIMESTAMP NOT NULL,
    CONSTRAINT uk_form_dedup UNIQUE (form_id, dedup_hash),
    CONSTRAINT fk_leads_site FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT fk_leads_form FOREIGN KEY (form_id) REFERENCES forms(id)
);

CREATE INDEX idx_leads_site_status ON leads (site_id, status);
CREATE INDEX idx_leads_assignee ON leads (assignee_id, status);
CREATE INDEX idx_leads_created ON leads (site_id, created_at);
