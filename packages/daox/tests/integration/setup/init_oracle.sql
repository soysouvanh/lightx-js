-- Oracle Database Integration Schema
DECLARE
    PROCEDURE drop_if_exists(p_table IN VARCHAR2) IS
    BEGIN
        EXECUTE IMMEDIATE 'DROP TABLE ' || p_table || ' CASCADE CONSTRAINTS';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE != -942 THEN RAISE; END IF;
    END;
BEGIN
    drop_if_exists('USER_ROLES');
    drop_if_exists('ORDER_ITEMS');
    drop_if_exists('CONFIGURATIONS');
    drop_if_exists('PRODUCT_METADATA');
    drop_if_exists('CURRENCIES');
    drop_if_exists('USERS');
END;
/

CREATE TABLE users (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR2(255) NOT NULL,
    first_name VARCHAR2(100),
    last_name VARCHAR2(100) NOT NULL,
    status VARCHAR2(50) DEFAULT 'active' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_email ON users (email);
CREATE INDEX idx_name ON users (last_name, first_name);

CREATE OR REPLACE VIEW active_users AS 
SELECT id, email, first_name, last_name 
FROM users 
WHERE status = 'active';

CREATE TABLE user_roles (
    user_id NUMBER NOT NULL,
    role_name VARCHAR2(50) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_user_id ON user_roles (user_id);
CREATE UNIQUE INDEX idx_user_role ON user_roles (user_id, role_name);

CREATE TABLE order_items (
    order_id NUMBER NOT NULL,
    product_id NUMBER NOT NULL,
    quantity NUMBER DEFAULT 1 NOT NULL,
    PRIMARY KEY (order_id, product_id)
);

CREATE TABLE configurations (
    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "type" VARCHAR2(50) NOT NULL,
    "match" VARCHAR2(255),
    value CLOB
);

CREATE TABLE product_metadata (
    id RAW(16) PRIMARY KEY,
    category VARCHAR2(50) NOT NULL CHECK (category IN ('tech', 'food', 'books')),
    attributes CLOB,
    raw_data BLOB
);

CREATE TABLE currencies (
    code VARCHAR2(3) PRIMARY KEY,
    name VARCHAR2(50) NOT NULL
);

-- Note: Oracle 23c supports multi-row inserts via simple INSERT ALL or standard VALUES. Using INSERT ALL for compatibility.
INSERT ALL
    INTO currencies (code, name) VALUES ('EUR', 'Euro')
    INTO currencies (code, name) VALUES ('USD', 'US Dollar')
    INTO currencies (code, name) VALUES ('GBP', 'British Pound')
    INTO currencies (code, name) VALUES ('JPY', 'Japanese Yen')
SELECT 1 FROM DUAL;

INSERT ALL
    INTO users (email, first_name, last_name, status) VALUES ('alice@example.com', 'Alice', 'Dupont', 'active')
    INTO users (email, first_name, last_name, status) VALUES ('bob@example.com', 'Bob', 'Martin', 'active')
    INTO users (email, first_name, last_name, status) VALUES ('charlie@example.com', 'Charlie', 'Durand', 'inactive')
    INTO users (email, first_name, last_name, status) VALUES ('diana@example.com', 'Diana', 'Prince', 'active')
SELECT 1 FROM DUAL;

INSERT ALL
    INTO user_roles (user_id, role_name) VALUES (1, 'admin')
    INTO user_roles (user_id, role_name) VALUES (1, 'user')
    INTO user_roles (user_id, role_name) VALUES (2, 'user')
    INTO user_roles (user_id, role_name) VALUES (3, 'guest')
    INTO user_roles (user_id, role_name) VALUES (4, 'manager')
SELECT 1 FROM DUAL;

INSERT ALL
    INTO order_items (order_id, product_id, quantity) VALUES (1001, 501, 2)
    INTO order_items (order_id, product_id, quantity) VALUES (1001, 502, 1)
    INTO order_items (order_id, product_id, quantity) VALUES (1002, 501, 5)
    INTO order_items (order_id, product_id, quantity) VALUES (1003, 503, 10)
SELECT 1 FROM DUAL;

INSERT ALL
    INTO configurations ("type", "match", value) VALUES ('theme', 'dark_mode', 'true')
    INTO configurations ("type", "match", value) VALUES ('language', 'default', 'fr-FR')
    INTO configurations ("type", "match", value) VALUES ('pagination', 'per_page', '25')
SELECT 1 FROM DUAL;

-- BLOBs/RAW need direct insert
INSERT INTO product_metadata (id, category, attributes, raw_data) VALUES (HEXTORAW('550E8400E29B41D4A716446655440000'), 'tech', '{"brand": "Apple", "warranty": "2 years"}', HEXTORAW('01'));
INSERT INTO product_metadata (id, category, attributes, raw_data) VALUES (HEXTORAW('123E4567E89B12D3A456426614174000'), 'food', '{"organic": true, "calories": 250}', HEXTORAW('02'));
INSERT INTO product_metadata (id, category, attributes, raw_data) VALUES (HEXTORAW('987E6543E21B34D5B678426614174111'), 'books', '{"pages": 350, "author": "John Doe"}', HEXTORAW('03'));

COMMIT;
