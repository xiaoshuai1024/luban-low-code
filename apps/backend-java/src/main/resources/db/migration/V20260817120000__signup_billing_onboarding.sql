-- signup-billing-onboarding（plan §9.3 原样）
-- 注册域（users.email / email_verifications）+ billing 域（plans/subscriptions/trial_records/
-- usage_counters/orders）+ 站点归属（sites.owner_user_id）+ 三档 seed（全 0 元）。

-- 1) users：注册域新列（存量行 email=NULL，唯一键允许多 NULL，登录不受影响）
ALTER TABLE users
    ADD COLUMN email VARCHAR(255) NULL AFTER username,
    ADD COLUMN email_verified_at DATETIME(3) NULL AFTER email,
    ADD UNIQUE KEY uk_users_email (email);

-- 2) 验证码（重发=插新行旧行自然作废）
CREATE TABLE email_verifications (
    id          VARCHAR(36)  PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    code_hash   VARCHAR(64)  NOT NULL,
    attempts    INT          NOT NULL DEFAULT 0,
    expires_at  DATETIME(3)  NOT NULL,
    consumed_at DATETIME(3)  NULL,
    created_at  DATETIME(3)  NOT NULL,
    INDEX idx_ev_email_created (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) 套餐（status 供 e2e hidden fixture；gates 预留）
CREATE TABLE plans (
    plan_code     VARCHAR(32) PRIMARY KEY,
    name          VARCHAR(64) NOT NULL,
    status        VARCHAR(16) NOT NULL DEFAULT 'visible',
    price_monthly BIGINT      NOT NULL DEFAULT 0,
    quota_leads   INT         NOT NULL DEFAULT 0,
    quota_pages   INT         NOT NULL DEFAULT 0,
    quota_visits  INT         NOT NULL DEFAULT 0,
    gates         JSON        NULL,
    trial_days    INT         NOT NULL DEFAULT 0,
    sort_order    INT         NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) 订阅（一人一条；verify 激活即插 free/active）
CREATE TABLE subscriptions (
    user_id          VARCHAR(36) PRIMARY KEY,
    plan_code        VARCHAR(32) NOT NULL,
    status           VARCHAR(16) NOT NULL DEFAULT 'active',
    started_at       DATETIME(3) NOT NULL,
    expires_at       DATETIME(3) NULL,
    trial_started_at DATETIME(3) NULL,
    trial_ends_at    DATETIME(3) NULL,
    created_at       DATETIME(3) NOT NULL,
    updated_at       DATETIME(3) NOT NULL,
    CONSTRAINT fk_sub_plan FOREIGN KEY (plan_code) REFERENCES plans(plan_code),
    CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sub_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) 试用记录（uk(user,plan) 支撑「Starter 首次」判定）
CREATE TABLE trial_records (
    id           VARCHAR(36) PRIMARY KEY,
    user_id      VARCHAR(36) NOT NULL,
    plan_code    VARCHAR(32) NOT NULL,
    started_at   DATETIME(3) NOT NULL,
    ends_at      DATETIME(3) NOT NULL,
    converted_to VARCHAR(32) NULL,
    created_at   DATETIME(3) NOT NULL,
    CONSTRAINT fk_trial_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_trial_plan FOREIGN KEY (plan_code) REFERENCES plans(plan_code),
    UNIQUE KEY uk_trial_user_plan (user_id, plan_code),
    INDEX idx_trial_ends (ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6) 用量计数（uk_usage 支撑原子累加）
CREATE TABLE usage_counters (
    id           VARCHAR(36) PRIMARY KEY,
    user_id      VARCHAR(36) NOT NULL,
    period_month CHAR(7)     NOT NULL,
    metric       VARCHAR(32) NOT NULL,
    count        BIGINT      NOT NULL DEFAULT 0,
    created_at   DATETIME(3) NOT NULL,
    updated_at   DATETIME(3) NOT NULL,
    CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_usage (user_id, period_month, metric)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7) 订单（orders 非 MySQL/H2 保留字）
CREATE TABLE orders (
    id         VARCHAR(36) PRIMARY KEY,
    order_no   VARCHAR(64) NOT NULL,
    user_id    VARCHAR(36) NOT NULL,
    plan_code  VARCHAR(32) NOT NULL,
    amount     BIGINT      NOT NULL DEFAULT 0,
    status     VARCHAR(16) NOT NULL DEFAULT 'pending',
    paid_at    DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    UNIQUE KEY uk_orders_order_no (order_no),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_plan FOREIGN KEY (plan_code) REFERENCES plans(plan_code),
    INDEX idx_orders_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8) sites 归属（存量 NULL=平台站点仅 admin；站点不随用户删除，故无 ON DELETE）
ALTER TABLE sites
    ADD COLUMN owner_user_id VARCHAR(36) NULL AFTER base_url,
    ADD INDEX idx_sites_owner (owner_user_id),
    ADD CONSTRAINT fk_sites_owner FOREIGN KEY (owner_user_id) REFERENCES users(id);

-- 9) 三档 seed（全 0 元；quota_visits=0=不限 §10.2）
INSERT INTO plans (plan_code, name, status, price_monthly, quota_leads, quota_pages, quota_visits, gates, trial_days, sort_order) VALUES
    ('free',    'Free',    'visible', 0,   100,  3, 0, NULL,  0, 1),
    ('starter', 'Starter', 'visible', 0,  1000, 10, 0, NULL, 14, 2),
    ('growth',  'Growth',  'visible', 0, 10000, 50, 0, NULL,  0, 3);
