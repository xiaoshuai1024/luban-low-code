-- H2 (MySQL compatibility mode) variant of V20260817120000__signup_billing_onboarding.sql
--
-- 转换惯例（对齐既有 V20260614000000 / V20260729000001 H2 变体）：
--   - DATETIME(3) → TIMESTAMP；JSON → CLOB（保 raw text 往返，见 init_schema 注释）
--   - 删 ENGINE=InnoDB / DEFAULT CHARSET / AFTER（H2 不支持/忽略）
--   - 内联 INDEX → 独立 CREATE INDEX
--   - ADD UNIQUE KEY → ADD CONSTRAINT ... UNIQUE
--   - seed 保留（三档全 0 元）

-- 1) users：email 唯一键允许多 NULL（两库一致，契约测试有 NULL 不冲突断言）
ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL;
ALTER TABLE users ADD CONSTRAINT uk_users_email UNIQUE (email);

-- 2) 验证码
CREATE TABLE email_verifications (
    id          VARCHAR(36)  PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    code_hash   VARCHAR(64)  NOT NULL,
    attempts    INT          NOT NULL DEFAULT 0,
    expires_at  TIMESTAMP    NOT NULL,
    consumed_at TIMESTAMP    NULL,
    created_at  TIMESTAMP    NOT NULL
);

CREATE INDEX idx_ev_email_created ON email_verifications (email, created_at);

-- 3) 套餐
CREATE TABLE plans (
    plan_code     VARCHAR(32) PRIMARY KEY,
    name          VARCHAR(64) NOT NULL,
    status        VARCHAR(16) NOT NULL DEFAULT 'visible',
    price_monthly BIGINT      NOT NULL DEFAULT 0,
    quota_leads   INT         NOT NULL DEFAULT 0,
    quota_pages   INT         NOT NULL DEFAULT 0,
    quota_visits  INT         NOT NULL DEFAULT 0,
    gates         CLOB        NULL,
    trial_days    INT         NOT NULL DEFAULT 0,
    sort_order    INT         NOT NULL DEFAULT 0
);

-- 4) 订阅
CREATE TABLE subscriptions (
    user_id          VARCHAR(36) PRIMARY KEY,
    plan_code        VARCHAR(32) NOT NULL,
    status           VARCHAR(16) NOT NULL DEFAULT 'active',
    started_at       TIMESTAMP   NOT NULL,
    expires_at       TIMESTAMP   NULL,
    trial_started_at TIMESTAMP   NULL,
    trial_ends_at    TIMESTAMP   NULL,
    created_at       TIMESTAMP   NOT NULL,
    updated_at       TIMESTAMP   NOT NULL,
    CONSTRAINT fk_sub_plan FOREIGN KEY (plan_code) REFERENCES plans(plan_code),
    CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sub_status ON subscriptions (status);

-- 5) 试用记录
CREATE TABLE trial_records (
    id           VARCHAR(36) PRIMARY KEY,
    user_id      VARCHAR(36) NOT NULL,
    plan_code    VARCHAR(32) NOT NULL,
    started_at   TIMESTAMP   NOT NULL,
    ends_at      TIMESTAMP   NOT NULL,
    converted_to VARCHAR(32) NULL,
    created_at   TIMESTAMP   NOT NULL,
    CONSTRAINT fk_trial_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_trial_plan FOREIGN KEY (plan_code) REFERENCES plans(plan_code),
    CONSTRAINT uk_trial_user_plan UNIQUE (user_id, plan_code)
);

CREATE INDEX idx_trial_ends ON trial_records (ends_at);

-- 6) 用量计数
CREATE TABLE usage_counters (
    id           VARCHAR(36) PRIMARY KEY,
    user_id      VARCHAR(36) NOT NULL,
    period_month CHAR(7)     NOT NULL,
    metric       VARCHAR(32) NOT NULL,
    count        BIGINT      NOT NULL DEFAULT 0,
    created_at   TIMESTAMP   NOT NULL,
    updated_at   TIMESTAMP   NOT NULL,
    CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_usage UNIQUE (user_id, period_month, metric)
);

-- 7) 订单
CREATE TABLE orders (
    id         VARCHAR(36) PRIMARY KEY,
    order_no   VARCHAR(64) NOT NULL,
    user_id    VARCHAR(36) NOT NULL,
    plan_code  VARCHAR(32) NOT NULL,
    amount     BIGINT      NOT NULL DEFAULT 0,
    status     VARCHAR(16) NOT NULL DEFAULT 'pending',
    paid_at    TIMESTAMP   NULL,
    created_at TIMESTAMP   NOT NULL,
    updated_at TIMESTAMP   NOT NULL,
    CONSTRAINT uk_orders_order_no UNIQUE (order_no),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_plan FOREIGN KEY (plan_code) REFERENCES plans(plan_code)
);

CREATE INDEX idx_orders_user_created ON orders (user_id, created_at);

-- 8) sites 归属（无 ON DELETE：站点不随用户删除）
ALTER TABLE sites ADD COLUMN owner_user_id VARCHAR(36) NULL;
ALTER TABLE sites ADD CONSTRAINT fk_sites_owner FOREIGN KEY (owner_user_id) REFERENCES users(id);

CREATE INDEX idx_sites_owner ON sites (owner_user_id);

-- 9) 三档 seed
INSERT INTO plans (plan_code, name, status, price_monthly, quota_leads, quota_pages, quota_visits, gates, trial_days, sort_order) VALUES
    ('free',    'Free',    'visible', 0,   100,  3, 0, NULL,  0, 1),
    ('starter', 'Starter', 'visible', 0,  1000, 10, 0, NULL, 14, 2),
    ('growth',  'Growth',  'visible', 0, 10000, 50, 0, NULL,  0, 3);
