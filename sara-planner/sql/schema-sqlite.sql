-- SQLite version of schema.sql (used automatically when DB_DRIVER is "sqlite")
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login    TIMESTAMP NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY,
  income  DECIMAL(10,2) NOT NULL DEFAULT 0,
  goal    DECIMAL(10,2) NOT NULL DEFAULT 0,
  note    VARCHAR(500)  NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Per-month changes: income for that month and/or a manual savings target
-- (NULL = use the normal value). month is 0 = January ... 11 = December.
CREATE TABLE IF NOT EXISTS month_money (
  user_id     INTEGER NOT NULL,
  year        INTEGER NOT NULL,
  month       TINYINTEGER NOT NULL,
  income      DECIMAL(10,2) NULL,
  save_target DECIMAL(10,2) NULL,
  saved_actual DECIMAL(10,2) NULL,  -- what the user confirmed they really saved (NULL = not confirmed yet)
  PRIMARY KEY (user_id, year, month),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  date        DATE NOT NULL,
  description VARCHAR(200) NOT NULL,
  category    VARCHAR(20)  NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  title      VARCHAR(200) NOT NULL,
  due        DATE NOT NULL,
  priority   VARCHAR(4)  NOT NULL DEFAULT 'med',
  tag        VARCHAR(40) NOT NULL DEFAULT '',
  done       TINYINT(1)  NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- One row per planned hour on a specific date
CREATE TABLE IF NOT EXISTS hours (
  user_id INTEGER NOT NULL,
  date    DATE NOT NULL,
  hour    TINYINTEGER NOT NULL,
  text    VARCHAR(200) NOT NULL DEFAULT '',
  type    VARCHAR(10)  NOT NULL DEFAULT 'personal',
  start_min TINYINTEGER NOT NULL DEFAULT 0,
  end_min   TINYINTEGER NOT NULL DEFAULT 60,
  PRIMARY KEY (user_id, date, hour),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Hours that repeat every week (weekday 0 = Monday ... 6 = Sunday)
CREATE TABLE IF NOT EXISTS weekly_hours (
  user_id INTEGER NOT NULL,
  weekday TINYINTEGER NOT NULL,
  hour    TINYINTEGER NOT NULL,
  text    VARCHAR(200) NOT NULL DEFAULT '',
  type    VARCHAR(10)  NOT NULL DEFAULT 'personal',
  start_min TINYINTEGER NOT NULL DEFAULT 0,
  end_min   TINYINTEGER NOT NULL DEFAULT 60,
  PRIMARY KEY (user_id, weekday, hour),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Study blocks that were ticked off ("date|startHour|title")
CREATE TABLE IF NOT EXISTS block_done (
  user_id   INTEGER NOT NULL,
  block_key VARCHAR(255) NOT NULL,
  PRIMARY KEY (user_id, block_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- The weekly study table (7 rows per user)
CREATE TABLE IF NOT EXISTS study_plan (
  user_id  INTEGER NOT NULL,
  weekday  TINYINTEGER NOT NULL,
  subject  VARCHAR(80)  NOT NULL DEFAULT '',
  topic    VARCHAR(120) NOT NULL DEFAULT '',
  hours    DECIMAL(4,1) NOT NULL DEFAULT 0,
  revised  TINYINT(1)   NOT NULL DEFAULT 0,
  priority TINYINT      NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, weekday),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS upcoming (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title   VARCHAR(150) NOT NULL,
  date    DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subjects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  name       VARCHAR(80) NOT NULL,
  color      VARCHAR(20) NOT NULL DEFAULT 'school',
  exam       DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chapters (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  title      VARCHAR(150) NOT NULL,
  done       TINYINT(1) NOT NULL DEFAULT 0,
  source     TEXT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS topics (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL,
  title      VARCHAR(200) NOT NULL,
  done       TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- Google Calendar connection (one per user) and the events the planner put there
CREATE TABLE IF NOT EXISTS google_accounts (
  user_id       INTEGER PRIMARY KEY,
  google_email  VARCHAR(190) NOT NULL DEFAULT '',
  refresh_token TEXT NOT NULL,
  access_token  TEXT NULL,
  expires_at    INTEGER NOT NULL DEFAULT 0,
  calendar_id   VARCHAR(255) NULL,
  synced_on     DATE NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gcal_events (
  user_id  INTEGER NOT NULL,
  date     DATE NOT NULL,
  event_id VARCHAR(190) NOT NULL,
  sig      CHAR(40) NOT NULL,
  PRIMARY KEY (user_id, event_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- The code emailed to confirm a new account's email
CREATE TABLE IF NOT EXISTS email_codes (
  user_id    INTEGER PRIMARY KEY,
  code_hash  VARCHAR(255) NOT NULL,
  expires_at INTEGER NOT NULL,
  sent_at    INTEGER NOT NULL,
  tries      TINYINTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat between users. sent_at is a Unix time, so it shows right in every time zone.
CREATE TABLE IF NOT EXISTS messages (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id  INTEGER NOT NULL,
  to_id    INTEGER NOT NULL,
  body     TEXT NOT NULL,
  sent_at  INTEGER NOT NULL,
  is_read  TINYINTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_id) REFERENCES users(id) ON DELETE CASCADE
);

-- What other people see about you: a short bio, a profile picture and the colour of your notebook cover.
CREATE TABLE IF NOT EXISTS profiles (
  user_id   INTEGER PRIMARY KEY,
  bio       VARCHAR(300) NOT NULL DEFAULT '',
  cover     VARCHAR(20)  NOT NULL DEFAULT 'meadow',
  words     VARCHAR(60)  NOT NULL DEFAULT '',
  avatar    MEDIUMTEXT NULL,
  avatar_v  INTEGER NOT NULL DEFAULT 0,
  slug       VARCHAR(40) NULL,
  is_public  TINYINT(1) NOT NULL DEFAULT 0,
  guest_view TINYINT(1) NOT NULL DEFAULT 0,
  share      TEXT NULL,
  design     TEXT NULL,
  notify     TEXT NULL,
  nb_ready   TINYINT(1) NOT NULL DEFAULT 0,
  look       VARCHAR(24) NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Friends. from_id asked to_id; accepted = 1 once to_id said yes.
CREATE TABLE IF NOT EXISTS friends (
  from_id   INTEGER NOT NULL,
  to_id     INTEGER NOT NULL,
  accepted  TINYINTEGER NOT NULL DEFAULT 0,
  sent_at   INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id),
  FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exp_user_date ON expenses(user_id,date);
CREATE INDEX IF NOT EXISTS idx_task_user_due ON tasks(user_id,due);
CREATE INDEX IF NOT EXISTS idx_gcal_user_date ON gcal_events(user_id,date);

CREATE INDEX IF NOT EXISTS idx_msg_to ON messages(to_id,from_id);
CREATE INDEX IF NOT EXISTS idx_msg_from ON messages(from_id,to_id);
CREATE INDEX IF NOT EXISTS idx_friend_to ON friends(to_id);

-- ---- Notebook sharing: pictures, blog, interest lists, likes, alerts ----
-- Pictures are kept in the database (like profile pictures), so no upload folder is needed on the host.
CREATE TABLE IF NOT EXISTS uploads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  kind       VARCHAR(10) NOT NULL,
  mime       VARCHAR(30) NOT NULL,
  data       MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  title      VARCHAR(150) NOT NULL,
  body       TEXT NOT NULL,
  image_id   INTEGER NULL,
  notebook_id INTEGER NULL,
  is_public  TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  body       VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interest_lists (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  title     VARCHAR(80) NOT NULL,
  emoji     VARCHAR(16) NOT NULL DEFAULT '',
  layout    VARCHAR(8) NOT NULL DEFAULT 'list',
  notebook_id INTEGER NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interest_items (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id  INTEGER NOT NULL,
  text     VARCHAR(150) NOT NULL,
  note     VARCHAR(300) NOT NULL DEFAULT '',
  image_id INTEGER NULL,
  FOREIGN KEY (list_id) REFERENCES interest_lists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  ref        VARCHAR(60) NOT NULL,
  text       VARCHAR(250) NOT NULL,
  link       VARCHAR(120) NOT NULL DEFAULT '',
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, ref),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notebooks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  title      VARCHAR(80) NOT NULL,
  intro      VARCHAR(300) NOT NULL DEFAULT '',
  sections   VARCHAR(120) NOT NULL DEFAULT '',
  design     TEXT NULL,
  is_public  TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notebook_styles (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name    VARCHAR(60) NOT NULL,
  design  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reports: someone reports another account. They are emailed to the ADMIN_EMAILS in config.php and listed on admin.php.
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  target_id   INTEGER NOT NULL,
  reason      VARCHAR(40) NOT NULL,
  details     VARCHAR(1000) NOT NULL DEFAULT '',
  resolved    TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Music: people's own Spotify accounts (the music player) and the Spotify link they last picked
CREATE TABLE IF NOT EXISTS spotify_accounts (
  user_id       INTEGER PRIMARY KEY,
  spotify_name  VARCHAR(190) NOT NULL DEFAULT '',
  refresh_token TEXT NOT NULL,
  access_token  TEXT NULL,
  expires_at    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_music (
  user_id INTEGER PRIMARY KEY,
  link    VARCHAR(255) NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Playlists (or albums, songs) someone saved on their Music page, shown as buttons
CREATE TABLE IF NOT EXISTS music_saved (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  link    VARCHAR(255) NOT NULL,
  title   VARCHAR(190) NOT NULL DEFAULT '',
  image   VARCHAR(255) NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Study notebook (notes.php): pages of notes and whiteboards, with study files. Only their owner sees them.
-- subject_id / chapter_id: the notebook (a subject from the Study tab) and chapter the page belongs to, if any.
-- The files themselves (and whiteboard drawings) are kept on disk in data/notes/<user id>/.
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  kind       VARCHAR(10) NOT NULL DEFAULT 'note',
  title      VARCHAR(120) NOT NULL DEFAULT '',
  subject    VARCHAR(80) NOT NULL DEFAULT '',
  subject_id INTEGER NULL,
  chapter_id INTEGER NULL,
  body       TEXT NULL,
  paper      VARCHAR(10) NOT NULL DEFAULT 'lined',
  board      VARCHAR(80) NULL,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS note_files (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  note_id    INTEGER NOT NULL,
  name       VARCHAR(160) NOT NULL,
  mime       VARCHAR(100) NOT NULL,
  size       INTEGER NOT NULL DEFAULT 0,
  path       VARCHAR(80) NOT NULL,
  created_at INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
