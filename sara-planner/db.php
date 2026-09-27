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

/** Send visitors who aren't logged in to the login page. */
function require_login(): int
{
    $id = current_user_id();
    if (!$id) {
        header('Location: welcome.php');
        exit;
    }
    return $id;
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
}

/** Create the rows every new user starts with. */
function create_user_defaults(int $uid): void
{
    q('INSERT INTO settings (user_id, income, goal, note) VALUES (?, 0, 0, ?)', [$uid, 'Tiny steps still count.']);
    for ($d = 0; $d < 7; $d++) {
        q('INSERT INTO study_plan (user_id, weekday) VALUES (?, ?)', [$uid, $d]);
    }
}
