-- D1 Database Initialization Schema for Fund Tracker
-- This script creates the tables for user auth, custom funds tracking, transactions, and scraping caches.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Tracked Funds Table (User Settings per Fund)
CREATE TABLE IF NOT EXISTS user_funds (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '未命名基金',
    sector TEXT DEFAULT '未分组',
    quote_source TEXT DEFAULT 'auto',
    holding_start_date TEXT DEFAULT '',
    bootstrap_shares_from_amount INTEGER DEFAULT 0,
    shares REAL DEFAULT 0,
    cost_amount REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, code)
);
CREATE INDEX IF NOT EXISTS idx_user_funds_lookup ON user_funds(user_id, code);

-- 3. Transactions Table (User Transaction Records)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    fund_code TEXT NOT NULL,
    fund_name TEXT NOT NULL DEFAULT '',
    fund_id INTEGER,
    type TEXT NOT NULL CHECK(type IN ('买入', '卖出', '分红')),
    amount REAL NOT NULL CHECK(amount >= 0),
    trade_date TEXT NOT NULL,
    reference_net_value REAL,
    shares_delta REAL,
    cost_delta REAL,
    source TEXT DEFAULT 'manual-sync',
    note TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_fund ON transactions(user_id, fund_code);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, trade_date);

-- 4. Fund Industry Cache Table (Crawler Cache)
CREATE TABLE IF NOT EXISTS fund_industry_cache (
    code TEXT PRIMARY KEY,
    data_json TEXT NOT NULL,
    last_scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Daily Profits Table (Daily performance logs per fund per user)
CREATE TABLE IF NOT EXISTS user_fund_daily_profits (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    fund_code TEXT NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    daily_profit REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, fund_code, date)
);
CREATE INDEX IF NOT EXISTS idx_user_fund_daily_profits_lookup ON user_fund_daily_profits(user_id, fund_code, date);

