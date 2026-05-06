CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'Staff',
    full_name VARCHAR(100),
    preferences JSONB
);

CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    floor INTEGER,
    rent_amount DOUBLE PRECISION,
    is_at_risk BOOLEAN DEFAULT FALSE,
    daily_revenue DOUBLE PRECISION DEFAULT 0,
    visitor_count INTEGER DEFAULT 0,
    performance_score DOUBLE PRECISION DEFAULT 100,
    owner_id INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    zone VARCHAR(100),
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200),
    description TEXT,
    priority VARCHAR(10) DEFAULT 'Medium',
    status VARCHAR(20) DEFAULT 'Pending',
    assigned_to INTEGER REFERENCES users(id),
    deadline TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parking_slots (
    id SERIAL PRIMARY KEY,
    slot_number VARCHAR(10) UNIQUE,
    level INTEGER DEFAULT 1,
    is_occupied BOOLEAN DEFAULT FALSE,
    type VARCHAR(20) DEFAULT 'Standard',
    occupancy_data JSONB
);

CREATE TABLE IF NOT EXISTS mall_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100),
    payload JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_shops_risk_score ON shops (is_at_risk, performance_score);
CREATE INDEX IF NOT EXISTS ix_shops_category_floor ON shops (category, floor);
CREATE INDEX IF NOT EXISTS ix_alerts_resolved_type ON alerts (is_resolved, type);
CREATE INDEX IF NOT EXISTS ix_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS ix_parking_occupied_level ON parking_slots (is_occupied, level);
CREATE INDEX IF NOT EXISTS ix_mall_events_type ON mall_events (event_type);
