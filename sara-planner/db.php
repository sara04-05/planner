<?php
// Shared helpers: database connection, sessions, CSRF protection.
declare(strict_types=1);

require __DIR__ . '/config.php';

// Safer session cookies
ini_set('session.use_strict_mode', '1');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Lax');
if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    ini_set('session.cookie_secure', '1');
}
session_start();

/** The one shared database connection. */
function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;

    $opts = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    if (DB_DRIVER === 'sqlite') {
        $isNew = !file_exists(SQLITE_PATH);
        $pdo = new PDO('sqlite:' . SQLITE_PATH, null, null, $opts);
        $pdo->exec('PRAGMA foreign_keys = ON');
        if ($isNew) {
            $pdo->exec(file_get_contents(__DIR__ . '/sql/schema-sqlite.sql'));
        }
    } else {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $opts);
    }
    upgrade_schema($pdo);
    return $pdo;
}

/** Add tables that came after the first version, so older databases keep working without a re-import. */
function upgrade_schema(PDO $pdo): void
{
    if (DB_DRIVER === 'sqlite') {
        $pdo->exec('CREATE TABLE IF NOT EXISTS month_money (
            user_id INTEGER NOT NULL, year INTEGER NOT NULL, month TINYINTEGER NOT NULL,
            income DECIMAL(10,2) NULL, save_target DECIMAL(10,2) NULL,
            PRIMARY KEY (user_id, year, month),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)');
    } else {
        $pdo->exec('CREATE TABLE IF NOT EXISTS month_money (
            user_id INT UNSIGNED NOT NULL, year SMALLINT UNSIGNED NOT NULL, month TINYINT UNSIGNED NOT NULL,
            income DECIMAL(10,2) NULL, save_target DECIMAL(10,2) NULL,
            PRIMARY KEY (user_id, year, month),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB');
    }

    // Where to find a chapter (book, author, literature). Only adds the column, existing rows are untouched.
    // If the host refuses the change, the site still opens; chapters just won't have a source box.
    try {
        $cols = DB_DRIVER === 'sqlite'
            ? array_column($pdo->query('PRAGMA table_info(chapters)')->fetchAll(), 'name')
            : array_column($pdo->query('SHOW COLUMNS FROM chapters')->fetchAll(), 'Field');
        if (!in_array('source', $cols, true)) {
            $pdo->exec('ALTER TABLE chapters ADD COLUMN source TEXT NULL');
        }
    } catch (PDOException $e) {
        error_log('Could not add chapters.source: ' . $e->getMessage());
    }

    // Minutes inside an hour (e.g. 08:15–08:45). 0 and 60 mean the whole hour, so old rows stay the same.
    foreach (['hours', 'weekly_hours'] as $table) {
        try {
            $cols = DB_DRIVER === 'sqlite'
                ? array_column($pdo->query("PRAGMA table_info($table)")->fetchAll(), 'name')
                : array_column($pdo->query("SHOW COLUMNS FROM $table")->fetchAll(), 'Field');
            if (!in_array('start_min', $cols, true)) {
                $pdo->exec("ALTER TABLE $table ADD COLUMN start_min TINYINT NOT NULL DEFAULT 0");
            }
            if (!in_array('end_min', $cols, true)) {
                $pdo->exec("ALTER TABLE $table ADD COLUMN end_min TINYINT NOT NULL DEFAULT 60");
            }
        } catch (PDOException $e) {
            error_log("Could not add minutes to $table: " . $e->getMessage());
        }
    }

    // When each user last logged in (shown on admin.php). Same safety net as above.
    try {
        $cols = DB_DRIVER === 'sqlite'
            ? array_column($pdo->query('PRAGMA table_info(users)')->fetchAll(), 'name')
            : array_column($pdo->query('SHOW COLUMNS FROM users')->fetchAll(), 'Field');
        if (!in_array('last_login', $cols, true)) {
            $pdo->exec('ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL');
        }
    } catch (PDOException $e) {
        error_log('Could not add users.last_login: ' . $e->getMessage());
    }

    // Google Calendar and email codes: same tables as in the schema file. Existing accounts count as confirmed (DEFAULT 1).
    try {
        $sql = file_get_contents(__DIR__ . (DB_DRIVER === 'sqlite' ? '/sql/schema-sqlite.sql' : '/sql/schema.sql'));
        foreach (['google_accounts', 'gcal_events', 'email_codes'] as $t) {
            if (preg_match("/CREATE TABLE IF NOT EXISTS $t \\(.*?\\n\\)[^;]*;/s", $sql, $m)) $pdo->exec($m[0]);
        }
        if (DB_DRIVER === 'sqlite') $pdo->exec('CREATE INDEX IF NOT EXISTS idx_gcal_user_date ON gcal_events(user_id,date)');
        $cols = DB_DRIVER === 'sqlite'
            ? array_column($pdo->query('PRAGMA table_info(users)')->fetchAll(), 'name')
            : array_column($pdo->query('SHOW COLUMNS FROM users')->fetchAll(), 'Field');
        if (!in_array('email_verified', $cols, true)) {
            $pdo->exec('ALTER TABLE users ADD COLUMN email_verified TINYINT NOT NULL DEFAULT 1');
        }
    } catch (PDOException $e) {
        error_log('Could not add the Google / email tables: ' . $e->getMessage());
    }
}

/** Run a prepared statement: q('SELECT * FROM x WHERE id = ?', [$id]) */
function q(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function check_csrf(?string $token): bool
{
    return is_string($token) && hash_equals(csrf_token(), $token);
}

function current_user_id(): ?int
{
    return isset($_SESSION['uid']) ? (int)$_SESSION['uid'] : null;
}

/** Send visitors who aren't logged in to the login page, and new accounts that haven't confirmed their email to verify.php. */
function require_login(bool $allowUnverified = false): int
{
    $id = current_user_id();
    if (!$id) {
        header('Location: welcome.php');
        exit;
    }
    if (!$allowUnverified && !is_verified($id)) {
        header('Location: verify.php');
        exit;
    }
    return $id;
}

/** Has this account confirmed its email? (Accounts from before the email check always have.) */
function is_verified(int $uid): bool
{
    try {
        $row = q('SELECT email_verified FROM users WHERE id = ?', [$uid])->fetch();
    } catch (PDOException $e) {   // column couldn't be added on this host
        return true;
    }
    return !$row || (int)$row['email_verified'] === 1;
}

/** Escape text for HTML. */
function h(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

/** Log a user in (new session id to prevent session fixation). */
function login_user(int $id): void
{
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
    unset($_SESSION['csrf']);
    try {
        q('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [$id]);
    } catch (PDOException $e) {
        error_log('Could not save last_login: ' . $e->getMessage());
    }
}

/** Is this user allowed to open admin.php? (ADMIN_EMAILS is set in config.php) */
function is_admin(int $uid): bool
{
    $admins = defined('ADMIN_EMAILS') ? array_map('strtolower', ADMIN_EMAILS) : [];
    if (!$admins) return false;
    $row = q('SELECT email FROM users WHERE id = ?', [$uid])->fetch();
    return $row && in_array(strtolower($row['email']), $admins, true);
}

/** Create the rows every new user starts with. */
function create_user_defaults(int $uid): void
{
    q('INSERT INTO settings (user_id, income, goal, note) VALUES (?, 0, 0, ?)', [$uid, 'Tiny steps still count.']);
    for ($d = 0; $d < 7; $d++) {
        q('INSERT INTO study_plan (user_id, weekday) VALUES (?, ?)', [$uid, $d]);
    }
}
