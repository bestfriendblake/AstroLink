-- =============================================================
-- AstroLink — Phase 1: Lunar Gateway
-- MySQL Schema Migration v001
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  username        VARCHAR(32)     NOT NULL,
  email           VARCHAR(255)    NOT NULL,
  password_hash   VARCHAR(255)    NOT NULL,
  global_level    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  global_xp       INT UNSIGNED    NOT NULL DEFAULT 0,
  stardust        DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
  is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
  is_banned       BOOLEAN         NOT NULL DEFAULT FALSE,
  ban_reason      VARCHAR(500)    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at   DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_email    (email),
  KEY idx_global_level   (global_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED  NOT NULL,
  token_hash  VARCHAR(255)  NOT NULL,
  expires_at  DATETIME      NOT NULL,
  revoked     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_hash (token_hash),
  KEY idx_user_id          (user_id),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pet_species (
  id              SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  internal_name   VARCHAR(64)       NOT NULL,
  display_name    VARCHAR(64)       NOT NULL,
  planet          ENUM('moon','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto') NOT NULL,
  rarity          ENUM('common','uncommon','rare','epic','legendary') NOT NULL,
  min_global_level SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_stealth_min  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  base_stealth_max  TINYINT UNSIGNED NOT NULL DEFAULT 10,
  base_evasion_min  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  base_evasion_max  TINYINT UNSIGNED NOT NULL DEFAULT 10,
  base_power_min    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  base_power_max    TINYINT UNSIGNED NOT NULL DEFAULT 10,
  base_endurance_min TINYINT UNSIGNED NOT NULL DEFAULT 1,
  base_endurance_max TINYINT UNSIGNED NOT NULL DEFAULT 10,
  description     TEXT NULL,
  sprite_key      VARCHAR(128) NULL,
  is_obtainable   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_internal_name (internal_name),
  KEY idx_planet_rarity       (planet, rarity),
  KEY idx_min_level           (min_global_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pets (
  id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED      NOT NULL,
  species_id  SMALLINT UNSIGNED NOT NULL,
  nickname    VARCHAR(64)       NULL,
  stat_stealth   TINYINT UNSIGNED NOT NULL,
  stat_evasion   TINYINT UNSIGNED NOT NULL,
  stat_power     TINYINT UNSIGNED NOT NULL,
  stat_endurance TINYINT UNSIGNED NOT NULL,
  pet_level   SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  pet_xp      INT UNSIGNED      NOT NULL DEFAULT 0,
  is_active   BOOLEAN           NOT NULL DEFAULT TRUE,
  is_locked   BOOLEAN           NOT NULL DEFAULT FALSE,
  caught_on_planet ENUM('moon','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto') NOT NULL,
  caught_at   DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_pets     (user_id, is_active),
  KEY idx_species       (species_id),
  CONSTRAINT fk_pet_user    FOREIGN KEY (user_id)    REFERENCES users(id)       ON DELETE CASCADE,
  CONSTRAINT fk_pet_species FOREIGN KEY (species_id) REFERENCES pet_species(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lunar_profiles (
  user_id         INT UNSIGNED  NOT NULL,
  lunar_xp        INT UNSIGNED  NOT NULL DEFAULT 0,
  lunar_level     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  total_landings        INT UNSIGNED NOT NULL DEFAULT 0,
  successful_landings   INT UNSIGNED NOT NULL DEFAULT 0,
  best_landing_score    INT UNSIGNED NOT NULL DEFAULT 0,
  total_stardust_earned DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  wisp_encounters   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  first_visited_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_visited_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_lp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS landing_telemetry (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED  NOT NULL,
  session_token   VARCHAR(64)   NOT NULL,
  fuel_used       SMALLINT UNSIGNED NOT NULL,
  final_velocity  DECIMAL(8,4)  NOT NULL,
  touchdown_x     DECIMAL(10,4) NOT NULL,
  touchdown_y     DECIMAL(10,4) NOT NULL,
  flight_duration_ms INT UNSIGNED NOT NULL,
  is_valid_landing   BOOLEAN     NOT NULL DEFAULT FALSE,
  validation_reason  VARCHAR(255) NULL,
  score_awarded      INT UNSIGNED NOT NULL DEFAULT 0,
  stardust_awarded   DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  flagged_for_review BOOLEAN     NOT NULL DEFAULT FALSE,
  submitted_at       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_session_token (session_token),
  KEY idx_user_telemetry      (user_id, submitted_at),
  CONSTRAINT fk_lt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_sessions (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED  NOT NULL,
  planet        ENUM('moon','mercury','venus','earth','mars','jupiter','saturn','uranus','neptune','pluto') NOT NULL,
  session_token VARCHAR(64)   NOT NULL,
  used          BOOLEAN       NOT NULL DEFAULT FALSE,
  expires_at    DATETIME      NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_session_token (session_token),
  KEY idx_user_sessions       (user_id),
  CONSTRAINT fk_gs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auction_listings (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  seller_id       INT UNSIGNED  NOT NULL,
  pet_id          INT UNSIGNED  NOT NULL,
  asking_price    DECIMAL(15,2) NOT NULL,
  status          ENUM('active','sold','cancelled','expired') NOT NULL DEFAULT 'active',
  buyer_id        INT UNSIGNED  NULL,
  sale_price      DECIMAL(15,2) NULL,
  expires_at      DATETIME      NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at     DATETIME      NULL,
  PRIMARY KEY (id),
  KEY idx_active_listings (status, expires_at),
  KEY idx_seller          (seller_id),
  CONSTRAINT fk_al_seller FOREIGN KEY (seller_id) REFERENCES users(id),
  CONSTRAINT fk_al_pet    FOREIGN KEY (pet_id)    REFERENCES pets(id),
  CONSTRAINT fk_al_buyer  FOREIGN KEY (buyer_id)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transaction_log (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED    NOT NULL,
  amount          DECIMAL(15,2)   NOT NULL,
  balance_after   DECIMAL(15,2)   NOT NULL,
  reason          ENUM('game_reward','auction_sale','auction_purchase','auction_refund','admin_grant','admin_deduct') NOT NULL,
  reference_id    INT UNSIGNED    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_transactions (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO pet_species
  (internal_name, display_name, planet, rarity, min_global_level,
   base_stealth_min, base_stealth_max, base_evasion_min, base_evasion_max,
   base_power_min, base_power_max, base_endurance_min, base_endurance_max,
   description, sprite_key)
VALUES
  ('lunar_moth_common', 'Lunar Moth', 'moon', 'common', 1,
   4, 8, 5, 9, 1, 4, 2, 6,
   'A pale silver moth that flickers between moonbeams. Curious and quick.',
   'pets/moon/lunar_moth'),
  ('crater_crawler_common', 'Crater Crawler', 'moon', 'common', 1,
   2, 5, 2, 5, 3, 7, 5, 9,
   'A sturdy six-legged creature that makes its home in impact craters.',
   'pets/moon/crater_crawler'),
  ('dust_sprite_uncommon', 'Dust Sprite', 'moon', 'uncommon', 5,
   6, 10, 6, 10, 2, 5, 1, 4,
   'Born from moondust kicked up by meteorites. Nearly invisible when still.',
   'pets/moon/dust_sprite'),
  ('regolith_hound_uncommon', 'Regolith Hound', 'moon', 'uncommon', 5,
   3, 7, 4, 8, 5, 9, 4, 8,
   'Loyal to a single trainer. Tracks footprints across the grey plains.',
   'pets/moon/regolith_hound'),
  ('spectral_wisp_rare', 'Spectral Wisp', 'moon', 'rare', 15,
   8, 14, 9, 15, 3, 7, 1, 5,
   'A ghost of lunar light that only manifests for seasoned explorers.',
   'pets/moon/spectral_wisp'),
  ('void_leviathan_epic', 'Void Leviathan', 'moon', 'epic', 30,
   10, 16, 10, 16, 8, 14, 6, 12,
   'Said to have drifted from deep space and anchored itself to the Moon''s dark side.',
   'pets/moon/void_leviathan');