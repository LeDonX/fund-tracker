-- D1 Database Initialization Schema for Fund Tracker
-- This script creates the users table for storing hashed credentials.

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user lookups by email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
