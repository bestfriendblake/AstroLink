-- =============================================================
-- AstroLink Migration 002 — Dailies & Currency
-- =============================================================

-- Add moonstone to users
ALTER TABLE users
  ADD COLUMN moonstone INT UNSIGNED NOT NULL DEFAULT 0 AFTER stardust;

-- ---------------------------------------------------------------
-- DAILY_STREAKS
-- One row per user, tracks login streak
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_streaks (
  user_id          INT UNSIGNED NOT NULL,
  current_streak   INT UNSIGNED NOT NULL DEFAULT 0,
  longest_streak   INT UNSIGNED NOT NULL DEFAULT 0,
  last_claim_date  DATE         NULL,
  total_claims     INT UNSIGNED NOT NULL DEFAULT 0,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_ds_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- DAILY_SPINS
-- One spin per user per day
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_spins (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  spin_date    DATE         NOT NULL,
  result_type  ENUM('stardust','moonstone','item','nothing') NOT NULL,
  result_value INT UNSIGNED NOT NULL DEFAULT 0,
  reels        VARCHAR(64)  NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_spin_date (user_id, spin_date),
  CONSTRAINT fk_spin_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- DAILY_QUESTS
-- 3 quests per user per day, refreshed at midnight UTC
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_quests (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  quest_date   DATE         NOT NULL,
  quest_type   ENUM('play_games','catch_pets','earn_stardust') NOT NULL,
  target       INT UNSIGNED NOT NULL,
  progress     INT UNSIGNED NOT NULL DEFAULT 0,
  completed    BOOLEAN      NOT NULL DEFAULT FALSE,
  reward_stardust  INT UNSIGNED NOT NULL DEFAULT 0,
  reward_moonstone INT UNSIGNED NOT NULL DEFAULT 0,
  claimed      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_quest_date_type (user_id, quest_date, quest_type),
  CONSTRAINT fk_dq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- STARDUST_CONVERSIONS
-- Log of stardust → moonstone trades
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stardust_conversions (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED NOT NULL,
  stardust_spent   INT UNSIGNED NOT NULL,
  moonstone_gained INT UNSIGNED NOT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_conversions (user_id),
  CONSTRAINT fk_sc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;