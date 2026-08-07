-- SQLite Database Integration Schema
-- Clean up existing artifacts
DROP VIEW IF EXISTS active_users;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;

-- Table definition
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    status TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    meta JSON
);
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status_created ON users(status, created_at);

CREATE TABLE roles (
    role_id INTEGER PRIMARY KEY,
    role_name TEXT NOT NULL
);

CREATE TABLE user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- View definition (ignored by Daox base table filters but available for manual queries)
CREATE VIEW active_users AS 
SELECT id, email FROM users WHERE status = 1;

-- Test Data Seeding
INSERT INTO roles (role_id, role_name) VALUES 
(1, 'Super Admin'),
(2, 'Moderator'),
(3, 'Visitor');
