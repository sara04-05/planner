-- Splanner: MySQL / MariaDB schema
-- Import this in phpMyAdmin (Import tab) or run: mysql -u root -p < sql/schema.sql

CREATE DATABASE IF NOT EXISTS sara_planner CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sara_planner;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login    TIMESTAMP NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS settings (
  user_id INT UNSIGNED PRIMARY KEY,
  income  DECIMAL(10,2) NOT NULL DEFAULT 0,
  goal    DECIMAL(10,2) NOT NULL DEFAULT 0,
  note    VARCHAR(500)  NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Per-month changes: income for that month and/or a manual savings target
-- (NULL = use the normal value). month is 0 = January ... 11 = December.
CREATE TABLE IF NOT EXISTS month_money (
  user_id     INT UNSIGNED NOT NULL,
  year        SMALLINT UNSIGNED NOT NULL,
  month       TINYINT UNSIGNED NOT NULL,
  income      DECIMAL(10,2) NULL,
  save_target DECIMAL(10,2) NULL,
  saved_actual DECIMAL(10,2) NULL,  -- what the user confirmed they really saved (NULL = not confirmed yet)
  PRIMARY KEY (user_id, year, month),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expenses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  date        DATE NOT NULL,
  description VARCHAR(200) NOT NULL,
  category    VARCHAR(20)  NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_exp_user_date (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tasks (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  title      VARCHAR(200) NOT NULL,
  due        DATE NOT NULL,
  priority   VARCHAR(4)  NOT NULL DEFAULT 'med',
  tag        VARCHAR(40) NOT NULL DEFAULT '',
  done       TINYINT(1)  NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_task_user_due (user_id, due),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- One row per planned hour on a specific date
CREATE TABLE IF NOT EXISTS hours (
  user_id INT UNSIGNED NOT NULL,
  date    DATE NOT NULL,
  hour    TINYINT UNSIGNED NOT NULL,
  text    VARCHAR(200) NOT NULL DEFAULT '',
  type    VARCHAR(10)  NOT NULL DEFAULT 'personal',
  start_min TINYINT NOT NULL DEFAULT 0,
  end_min   TINYINT UNSIGNED NOT NULL DEFAULT 60,
  PRIMARY KEY (user_id, date, hour),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Hours that repeat every week (weekday 0 = Monday ... 6 = Sunday)
CREATE TABLE IF NOT EXISTS weekly_hours (
  user_id INT UNSIGNED NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  hour    TINYINT UNSIGNED NOT NULL,
  text    VARCHAR(200) NOT NULL DEFAULT '',
  type    VARCHAR(10)  NOT NULL DEFAULT 'personal',
  start_min TINYINT NOT NULL DEFAULT 0,
  end_min   TINYINT UNSIGNED NOT NULL DEFAULT 60,
  PRIMARY KEY (user_id, weekday, hour),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Study blocks that were ticked off ("date|startHour|title")
CREATE TABLE IF NOT EXISTS block_done (
  user_id   INT UNSIGNED NOT NULL,
  block_key VARCHAR(255) NOT NULL,
  PRIMARY KEY (user_id, block_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- The weekly study table (7 rows per user)
CREATE TABLE IF NOT EXISTS study_plan (
  user_id  INT UNSIGNED NOT NULL,
  weekday  TINYINT UNSIGNED NOT NULL,
  subject  VARCHAR(80)  NOT NULL DEFAULT '',
  topic    VARCHAR(120) NOT NULL DEFAULT '',
  hours    DECIMAL(4,1) NOT NULL DEFAULT 0,
  revised  TINYINT(1)   NOT NULL DEFAULT 0,
  priority TINYINT      NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, weekday),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS upcoming (
  id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  title   VARCHAR(150) NOT NULL,
  date    DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subjects (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(80) NOT NULL,
  color      VARCHAR(20) NOT NULL DEFAULT 'school',
  exam       DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chapters (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subject_id INT UNSIGNED NOT NULL,
  title      VARCHAR(150) NOT NULL,
  done       TINYINT(1) NOT NULL DEFAULT 0,
  source     TEXT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS topics (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chapter_id INT UNSIGNED NOT NULL,
  title      VARCHAR(200) NOT NULL,
  done       TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Google Calendar connection (one per user) and the events the planner put there
CREATE TABLE IF NOT EXISTS google_accounts (
  user_id       INT UNSIGNED PRIMARY KEY,
  google_email  VARCHAR(190) NOT NULL DEFAULT '',
  refresh_token TEXT NOT NULL,
  access_token  TEXT NULL,
  expires_at    INT UNSIGNED NOT NULL DEFAULT 0,
  calendar_id   VARCHAR(255) NULL,
  synced_on     DATE NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gcal_events (
  user_id  INT UNSIGNED NOT NULL,
  date     DATE NOT NULL,
  event_id VARCHAR(190) NOT NULL,
  sig      CHAR(40) NOT NULL,
  PRIMARY KEY (user_id, event_id),
  INDEX idx_gcal_user_date (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- The code emailed to confirm a new account's email
CREATE TABLE IF NOT EXISTS email_codes (
  user_id    INT UNSIGNED PRIMARY KEY,
  code_hash  VARCHAR(255) NOT NULL,
  expires_at INT UNSIGNED NOT NULL,
  sent_at    INT UNSIGNED NOT NULL,
  tries      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Chat between users. sent_at is a Unix time, so it shows right in every time zone.
CREATE TABLE IF NOT EXISTS messages (
  id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  from_id  INT UNSIGNED NOT NULL,
  to_id    INT UNSIGNED NOT NULL,
  body     TEXT NOT NULL,
  sent_at  INT UNSIGNED NOT NULL,
  is_read  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_msg_to (to_id, from_id),
  INDEX idx_msg_from (from_id, to_id),
  FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- What other people see about you: a short bio, a profile picture and the colour of your notebook cover.
-- avatar holds the picture itself ("image/jpeg;<base64>"), so no upload folder is needed on the host.
CREATE TABLE IF NOT EXISTS profiles (
  user_id   INT UNSIGNED PRIMARY KEY,
  bio       VARCHAR(300) NOT NULL DEFAULT '',
  cover     VARCHAR(20)  NOT NULL DEFAULT 'meadow',
  words     VARCHAR(60)  NOT NULL DEFAULT '',
  avatar    MEDIUMTEXT NULL,
  avatar_v  INT UNSIGNED NOT NULL DEFAULT 0,
  -- notebook sharing (added later): page name, who may see the notebook, what is shown, the design, which alerts to get
  slug       VARCHAR(40) NULL UNIQUE,
  is_public  TINYINT(1) NOT NULL DEFAULT 0,
  guest_view TINYINT(1) NOT NULL DEFAULT 0,
  share      TEXT NULL,
  design     TEXT NULL,
  notify     TEXT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Friends. from_id asked to_id; accepted = 1 once to_id said yes. Friends can see each other's day.
CREATE TABLE IF NOT EXISTS friends (
  from_id   INT UNSIGNED NOT NULL,
  to_id     INT UNSIGNED NOT NULL,
  accepted  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  sent_at   INT UNSIGNED NOT NULL,
  PRIMARY KEY (from_id, to_id),
  INDEX idx_friend_to (to_id),
  FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_id) REFERENCES users(id) ON DELETE CASCADE

-- ---- Notebook sharing: pictures, blog, interest lists, likes, alerts ----
-- Pictures are kept in the database (like profile pictures), so no upload folder is needed on the host.
CREATE TABLE IF NOT EXISTS uploads (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  kind       VARCHAR(10) NOT NULL,
  mime       VARCHAR(30) NOT NULL,
  data       MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS posts (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  title      VARCHAR(150) NOT NULL,
  body       TEXT NOT NULL,
  image_id   INT UNSIGNED NULL,
  is_public  TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS post_likes (
  post_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS interest_lists (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id   INT UNSIGNED NOT NULL,
  title     VARCHAR(80) NOT NULL,
  emoji     VARCHAR(16) NOT NULL DEFAULT '',
  layout    VARCHAR(8) NOT NULL DEFAULT 'list',
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS interest_items (
  id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  list_id  INT UNSIGNED NOT NULL,
  text     VARCHAR(150) NOT NULL,
  note     VARCHAR(300) NOT NULL DEFAULT '',
  image_id INT UNSIGNED NULL,
  FOREIGN KEY (list_id) REFERENCES interest_lists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  ref        VARCHAR(60) NOT NULL,
  text       VARCHAR(250) NOT NULL,
  link       VARCHAR(120) NOT NULL DEFAULT '',
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notif_ref (user_id, ref),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
