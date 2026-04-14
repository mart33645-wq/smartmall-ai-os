-- Database: smartmall

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'Manager',
    full_name VARCHAR(100)
);

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    floor INT,
    rent_amount FLOAT,
    revenue_daily JSONB,
    owner_id INT REFERENCES users(id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200),
    description TEXT,
    priority VARCHAR(10) DEFAULT 'Medium',
    status VARCHAR(20) DEFAULT 'Pending',
    assigned_to INT REFERENCES users(id),
    deadline TIMESTAMP
);

-- Parking slots table
CREATE TABLE IF NOT EXISTS parking_slots (
    id SERIAL PRIMARY KEY,
    slot_number VARCHAR(10) UNIQUE,
    is_occupied BOOLEAN DEFAULT FALSE,
    type VARCHAR(20) DEFAULT 'Standard'
);

-- Seed Data (Optional)
INSERT INTO users (username, hashed_password, role, full_name) 
VALUES ('admin', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6L95fI/m6WqY1hS2', 'Admin', 'Mall Administrator');

INSERT INTO shops (name, category, floor, rent_amount) 
VALUES ('Fashion Hub', 'Apparel', 1, 5000.0), ('Gadget Galaxy', 'Electronics', 2, 7500.0);
