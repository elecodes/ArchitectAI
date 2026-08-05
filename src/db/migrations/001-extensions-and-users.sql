-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users table (single user for MVP, seeded below)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed admin user (password: "architect" — bcrypt hash)
INSERT INTO users (username, password_hash) VALUES (
  'admin',
  '$2b$10$L6RHwc/MvRhdQzE8Cc8fhemDVIB6mO6hMWbYCqP99WuOVZsRn1eee'
);
