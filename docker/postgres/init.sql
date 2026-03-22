-- FHIRBridge PostgreSQL Initialization
-- Audit and usage tracking tables only — NO PHI stored.
-- User identifiers are always HMAC-SHA256 hashes, never raw values.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Audit Log Table ──────────────────────────────────────────────────────────
-- Records all significant user actions for compliance and debugging.
-- NO PHI: user_id_hash is HMAC-SHA256 of real identifier.
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  user_id_hash   VARCHAR(64)  NOT NULL,          -- HMAC-SHA256, not raw user ID
  action         VARCHAR(50)  NOT NULL,           -- e.g. export_start, export_complete
  resource_count INTEGER,                         -- number of FHIR resources in operation
  status         VARCHAR(20)  NOT NULL,           -- success | error | pending
  metadata       JSONB                            -- non-PHI contextual data
);

-- Index for efficient lookup by user (hashed) and time range
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_hash ON audit_logs (user_id_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp  ON audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs (action);

-- ── Usage Tracking Table ─────────────────────────────────────────────────────
-- Records per-export usage metrics for billing and analytics.
-- NO PHI: user_id_hash is HMAC-SHA256.
CREATE TABLE IF NOT EXISTS usage_tracking (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  user_id_hash   VARCHAR(64)  NOT NULL,          -- HMAC-SHA256, not raw user ID
  export_type    VARCHAR(20)  NOT NULL,           -- fhir-json | fhir-ndjson | csv | pdf
  resource_count INTEGER      NOT NULL,           -- number of FHIR resources exported
  duration_ms    INTEGER,                         -- export duration in milliseconds
  tier           VARCHAR(10)  NOT NULL DEFAULT 'free'  -- free | cloud
);

-- Index for usage analytics and billing queries
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_hash ON usage_tracking (user_id_hash);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_timestamp  ON usage_tracking (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_tier       ON usage_tracking (tier);

-- ── Verify Tables Created ────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'FHIRBridge audit tables initialized successfully.';
  RAISE NOTICE 'Tables: audit_logs, usage_tracking';
  RAISE NOTICE 'NO PHI is stored — user_id_hash is HMAC-SHA256 only.';
END $$;
