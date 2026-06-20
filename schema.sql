-- Makyton bot database schema
-- This runs automatically on bot startup (see db.js -> initDb), so you don't
-- need to run it manually. Kept here for reference / manual inspection.

CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  wallet_address TEXT,
  verified BOOLEAN DEFAULT FALSE,
  balance INTEGER DEFAULT 0,

  -- task flags (each task only ever pays out once per user)
  joined_task_done BOOLEAN DEFAULT FALSE,
  started_bot_task_done BOOLEAN DEFAULT FALSE,

  -- referrals
  referred_by BIGINT,
  referral_awarded BOOLEAN DEFAULT FALSE, -- whether referrer has been paid for THIS user
  referral_count INTEGER DEFAULT 0,       -- cached count of people this user referred

  -- verification flow state machine
  awaiting_wallet BOOLEAN DEFAULT FALSE,
  pending_wallet TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_balance ON users (balance DESC);
