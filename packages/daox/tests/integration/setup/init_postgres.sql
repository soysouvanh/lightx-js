-- Une table classique avec une PK
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_email ON users (email);
CREATE INDEX idx_name ON users (last_name, first_name);

-- Une vue : ne générera que les fonctions de lecture (get, stream, list...)
CREATE VIEW active_users AS 
SELECT id, email, first_name, last_name 
FROM users 
WHERE status = 'active';

-- Une table de relation (sans PK explicite, mais avec des index)
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_user_id ON user_roles (user_id);
CREATE UNIQUE INDEX idx_user_role ON user_roles (user_id, role_name);

-- 1. Clé primaire composite
CREATE TABLE order_items (
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    PRIMARY KEY (order_id, product_id)
);

-- 2. Mots-clés réservés en Rust / Framework divers
CREATE TABLE configurations (
    id SERIAL PRIMARY KEY,
    "type" VARCHAR(50) NOT NULL,
    "match" VARCHAR(255),
    value TEXT
);

-- 3. Types de données complexes
CREATE TYPE category_enum AS ENUM ('tech', 'food', 'books');
CREATE TABLE product_metadata (
    id BYTEA PRIMARY KEY,
    category category_enum NOT NULL,
    attributes JSON,
    raw_data BYTEA
);

-- 4. Clé primaire SANS auto-increment
CREATE TABLE currencies (
    code VARCHAR(3) PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- ==========================================
-- JEU DE DONNÉES DE TEST (DUMP INITIAL)
-- ==========================================

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

INSERT INTO configurations ("type", "match", value) VALUES 
('theme', 'dark_mode', 'true'), ('language', 'default', 'fr-FR'), ('pagination', 'per_page', '25');

INSERT INTO product_metadata (id, category, attributes, raw_data) VALUES 
(decode('550e8400e29b41d4a716446655440000', 'hex'), 'tech', '{"brand": "Apple", "warranty": "2 years"}', 'binary_data_1'::bytea),
(decode('123e4567e89b12d3a456426614174000', 'hex'), 'food', '{"organic": true, "calories": 250}', 'binary_data_2'::bytea),
(decode('987e6543e21b34d5b678426614174111', 'hex'), 'books', '{"pages": 350, "author": "John Doe"}', 'binary_data_3'::bytea);
