-- SQL Server Database Integration Schema
USE db;
GO

IF OBJECT_ID('active_users', 'V') IS NOT NULL DROP VIEW active_users;
IF OBJECT_ID('user_roles', 'U') IS NOT NULL DROP TABLE user_roles;
IF OBJECT_ID('order_items', 'U') IS NOT NULL DROP TABLE order_items;
IF OBJECT_ID('configurations', 'U') IS NOT NULL DROP TABLE configurations;
IF OBJECT_ID('product_metadata', 'U') IS NOT NULL DROP TABLE product_metadata;
IF OBJECT_ID('currencies', 'U') IS NOT NULL DROP TABLE currencies;
IF OBJECT_ID('users', 'U') IS NOT NULL DROP TABLE users;
GO

CREATE TABLE users (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at DATETIME2 DEFAULT GETDATE()
);
CREATE UNIQUE INDEX idx_email ON users (email);
CREATE INDEX idx_name ON users (last_name, first_name);
GO

CREATE VIEW active_users AS 
SELECT id, email, first_name, last_name 
FROM users 
WHERE status = 'active';
GO

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    assigned_at DATETIME2 DEFAULT GETDATE()
);
CREATE INDEX idx_user_id ON user_roles (user_id);
CREATE UNIQUE INDEX idx_user_role ON user_roles (user_id, role_name);

CREATE TABLE order_items (
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    PRIMARY KEY (order_id, product_id)
);

CREATE TABLE configurations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    [type] VARCHAR(50) NOT NULL,
    [match] VARCHAR(255),
    value NVARCHAR(MAX)
);

CREATE TABLE product_metadata (
    id VARBINARY(16) PRIMARY KEY,
    category VARCHAR(50) NOT NULL CHECK (category IN ('tech', 'food', 'books')),
    attributes NVARCHAR(MAX),
    raw_data VARBINARY(MAX)
);

CREATE TABLE currencies (
    code VARCHAR(3) PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);
GO

INSERT INTO currencies (code, name) VALUES 
('EUR', 'Euro'), ('USD', 'US Dollar'), ('GBP', 'British Pound'), ('JPY', 'Japanese Yen');

INSERT INTO users (email, first_name, last_name, status) VALUES 
('alice@example.com', 'Alice', 'Dupont', 'active'),
('bob@example.com', 'Bob', 'Martin', 'active'),
('charlie@example.com', 'Charlie', 'Durand', 'inactive'),
('diana@example.com', 'Diana', 'Prince', 'active');

INSERT INTO user_roles (user_id, role_name) VALUES 
(1, 'admin'), (1, 'user'), (2, 'user'), (3, 'guest'), (4, 'manager');

INSERT INTO order_items (order_id, product_id, quantity) VALUES 
(1001, 501, 2), (1001, 502, 1), (1002, 501, 5), (1003, 503, 10);

INSERT INTO configurations ([type], [match], value) VALUES 
('theme', 'dark_mode', 'true'), ('language', 'default', 'fr-FR'), ('pagination', 'per_page', '25');

INSERT INTO product_metadata (id, category, attributes, raw_data) VALUES 
(0x550e8400e29b41d4a716446655440000, 'tech', '{"brand": "Apple", "warranty": "2 years"}', 0x01),
(0x123e4567e89b12d3a456426614174000, 'food', '{"organic": true, "calories": 250}', 0x02),
(0x987e6543e21b34d5b678426614174111, 'books', '{"pages": 350, "author": "John Doe"}', 0x03);
GO
