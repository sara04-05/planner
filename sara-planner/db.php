<?php
// Shared helpers: database connection, sessions, CSRF protection.
declare(strict_types=1);

// If something breaks, show a short note saying what and where, instead of the browser's blank "HTTP ERROR 500".
function show_site_error(string $msg, string $file, int $line): void
{
    if (!headers_sent()) http_response_code(500);
    $where = basename($file) . ' line ' . $line;
    error_log("Splanner error: $msg in $where");
    if (basename((string)($_SERVER['SCRIPT_NAME'] ?? '')) === 'api.php') {
        echo json_encode(['error' => "Server error: $msg ($where)"]);
        return;
    }
    if (preg_match('/SQLSTATE\[HY000\] \[\d+\]|Access denied for user|Unknown database|Connection refused|max_user_connections/i', $msg)) {
        $msg = 'The site cannot connect to its database. Check DB_HOST, DB_NAME, DB_USER and DB_PASS in config.php, or try again in a few minutes. (' . $msg . ')';
    }
    echo '<!doctype html><meta charset="utf-8"><title>Splanner error</title>'
        . '<div style="font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 16px">'
        . '<h1 style="font-size:22px">Something went wrong</h1>'
        . '<p>' . htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p style="color:#777">' . htmlspecialchars($where, ENT_QUOTES, 'UTF-8') . '</p></div>';
}
set_exception_handler(function (Throwable $e): void {
    show_site_error($e->getMessage(), $e->getFile(), $e->getLine());
});
register_shutdown_function(function (): void {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        show_site_error($e['message'], $e['file'], $e['line']);
    }
});

if (!is_file(__DIR__ . '/config.php')) {
    show_site_error('config.php is missing. Upload your own config.php (with your database login) next to db.php.', __FILE__, __LINE__);
    exit;
}
// Kosovo / Prishtina time unless config.php says otherwise (hosts usually run on UTC)
date_default_timezone_set('Europe/Belgrade');
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
        // Give up after 10 seconds instead of hanging when the database server can't be reached
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $opts + [PDO::ATTR_TIMEOUT => 10]);
        // Dates the database fills in itself (CURRENT_TIMESTAMP) use the same time zone as PHP. An offset like +02:00
        // is used because named zones are not installed on every host.
        $pdo->exec("SET time_zone = '" . date('P') . "'");
    }
    // Checking for missing tables/columns takes about ten database round trips, so it runs only
    // once per version of this file (remembered in data/), not on every page and every save.
    $mark = __DIR__ . '/data/schema-' . md5_file(__FILE__) . '.ok';
    if (!is_file($mark)) {
        @mkdir(dirname($mark));
        upgrade_schema($pdo);
        @file_put_contents($mark, date('c'));
    }
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
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    }

    // What the user confirmed they really saved in a month. Only adds the column.
    try {
        $cols = DB_DRIVER === 'sqlite'
            ? array_column($pdo->query('PRAGMA table_info(month_money)')->fetchAll(), 'name')
            : array_column($pdo->query('SHOW COLUMNS FROM month_money')->fetchAll(), 'Field');
        if (!in_array('saved_actual', $cols, true)) {
            $pdo->exec('ALTER TABLE month_money ADD COLUMN saved_actual DECIMAL(10,2) NULL');
        }
    } catch (PDOException $e) {
        error_log('Could not add month_money.saved_actual: ' . $e->getMessage());
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
            // start_min can be negative (an hour that starts early, e.g. 18:30 in the 19:00 row)
            if (DB_DRIVER !== 'sqlite') {
                $type = $pdo->query("SHOW COLUMNS FROM $table LIKE 'start_min'")->fetch()['Type'] ?? '';
                if (stripos($type, 'unsigned') !== false) {
                    $pdo->exec("ALTER TABLE $table MODIFY start_min TINYINT NOT NULL DEFAULT 0");
                }
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

    // Chat, profiles and friends: same tables as in the schema file.
    try {
        $sql = file_get_contents(__DIR__ . (DB_DRIVER === 'sqlite' ? '/sql/schema-sqlite.sql' : '/sql/schema.sql'));
        foreach (['messages', 'profiles', 'friends', 'reports'] as $t) {
            if (preg_match("/CREATE TABLE IF NOT EXISTS $t \\(.*?\\n\\)[^;]*;/s", $sql, $m)) $pdo->exec($m[0]);
        }
        if (DB_DRIVER === 'sqlite') {
            $pdo->exec('CREATE INDEX IF NOT EXISTS idx_msg_to ON messages(to_id,from_id)');
            $pdo->exec('CREATE INDEX IF NOT EXISTS idx_msg_from ON messages(from_id,to_id)');
            $pdo->exec('CREATE INDEX IF NOT EXISTS idx_friend_to ON friends(to_id)');
        }
        // Words on a spiral notebook cover (came after the first version of the profiles table)
        $cols = DB_DRIVER === 'sqlite'
            ? array_column($pdo->query('PRAGMA table_info(profiles)')->fetchAll(), 'name')
            : array_column($pdo->query('SHOW COLUMNS FROM profiles')->fetchAll(), 'Field');
        if (!in_array('words', $cols, true)) {
            $pdo->exec("ALTER TABLE profiles ADD COLUMN words VARCHAR(60) NOT NULL DEFAULT ''");
        }
    } catch (PDOException $e) {
        error_log('Could not add the chat / profile / friends tables: ' . $e->getMessage());
    }

    // Notebook sharing: extra columns on the profiles table (page name, who may see it, what is shown, design, alerts),
    // and the tables for pictures, blog posts, interest lists, likes and alerts. Existing rows are untouched.
    try {
        $sql = file_get_contents(__DIR__ . (DB_DRIVER === 'sqlite' ? '/sql/schema-sqlite.sql' : '/sql/schema.sql'));
        $colsOf = fn(string $t): array => DB_DRIVER === 'sqlite'
            ? array_column($pdo->query("PRAGMA table_info($t)")->fetchAll(), 'name')
            : array_column($pdo->query("SHOW COLUMNS FROM $t")->fetchAll(), 'Field');
        $have = $colsOf('profiles');
        foreach (['slug' => 'VARCHAR(40) NULL', 'is_public' => 'TINYINT(1) NOT NULL DEFAULT 0', 'guest_view' => 'TINYINT(1) NOT NULL DEFAULT 0',
                  'share' => 'TEXT NULL', 'design' => 'TEXT NULL', 'notify' => 'TEXT NULL', 'nb_ready' => 'TINYINT(1) NOT NULL DEFAULT 0'] as $c => $def) {
            if (!in_array($c, $have, true)) $pdo->exec("ALTER TABLE profiles ADD COLUMN $c $def");
        }
        if (DB_DRIVER === 'sqlite') {
            $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_slug ON profiles(slug)');
        } elseif (!$pdo->query("SHOW INDEX FROM profiles WHERE Column_name = 'slug' AND Non_unique = 0")->fetch()) {
            $pdo->exec('ALTER TABLE profiles ADD UNIQUE KEY uq_profiles_slug (slug)');
        }
        // An early test version kept pictures as files on disk; that table has no "data" column. Set it aside.
        $up = $pdo->query(DB_DRIVER === 'sqlite' ? "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'uploads'" : "SHOW TABLES LIKE 'uploads'")->fetch();
        if ($up && !in_array('data', $colsOf('uploads'), true)) $pdo->exec('ALTER TABLE uploads RENAME TO uploads_old_files');
        foreach (['uploads', 'posts', 'post_likes', 'post_comments', 'interest_lists', 'interest_items', 'notifications', 'notebooks', 'notebook_styles'] as $t) {
            if (preg_match("/CREATE TABLE IF NOT EXISTS $t \\(.*?\\n\\)[^;]*;/s", $sql, $m)) $pdo->exec($m[0]);
        }
        // Blog posts and interest lists now belong to one notebook
        foreach (['posts', 'interest_lists'] as $t) {
            if (!in_array('notebook_id', $colsOf($t), true)) $pdo->exec("ALTER TABLE $t ADD COLUMN notebook_id INT NULL");
        }
    } catch (PDOException $e) {
        error_log('Could not add the notebook sharing tables: ' . $e->getMessage());
    }

    // Google Calendar and email codes: same tables as in the schema file. Existing accounts count as confirmed (DEFAULT 1).
    try {
        $sql = file_get_contents(__DIR__ . (DB_DRIVER === 'sqlite' ? '/sql/schema-sqlite.sql' : '/sql/schema.sql'));
        foreach (['google_accounts', 'gcal_events', 'email_codes'] as $t) {
            if (preg_match("/CREATE TABLE IF NOT EXISTS $t \\(.*?\\n\\)[^;]*;/s", $sql, $m)) $pdo->exec($m[0]);
        }
        if (DB_DRIVER === 'sqlite') {
            $pdo->exec('CREATE INDEX IF NOT EXISTS idx_gcal_user_date ON gcal_events(user_id,date)');
        }
        $cols = DB_DRIVER === 'sqlite'
            ? array_column($pdo->query('PRAGMA table_info(users)')->fetchAll(), 'name')
            : array_column($pdo->query('SHOW COLUMNS FROM users')->fetchAll(), 'Field');
        if (!in_array('email_verified', $cols, true)) {
            $pdo->exec('ALTER TABLE users ADD COLUMN email_verified TINYINT NOT NULL DEFAULT 1');
        }
    } catch (PDOException $e) {
        error_log('Could not add the Google / email tables: ' . $e->getMessage());
    }
    // Roles, verified badge, "hide me from Explore", deleting / editing chat messages and contact names. Only adds columns and a table.
    try {
        $colsOf = fn(string $t): array => DB_DRIVER === 'sqlite'
            ? array_column($pdo->query("PRAGMA table_info($t)")->fetchAll(), 'name')
            : array_column($pdo->query("SHOW COLUMNS FROM $t")->fetchAll(), 'Field');
        $add = function (string $t, string $c, string $def) use ($pdo, $colsOf): void {
            if (!in_array($c, $colsOf($t), true)) $pdo->exec("ALTER TABLE $t ADD COLUMN $c $def");
        };
        $add('users', 'role', "VARCHAR(12) NOT NULL DEFAULT 'user'");
        $add('users', 'verified_badge', 'TINYINT(1) NOT NULL DEFAULT 0');
        // A site with nobody in ADMIN_EMAILS and no admin yet: the first account made on the site becomes its admin
        // (otherwise nobody could ever open the Users page or give anyone a role).
        if (!(defined('ADMIN_EMAILS') && ADMIN_EMAILS) && !$pdo->query("SELECT 1 FROM users WHERE role = 'admin'")->fetch()) {
            $first = $pdo->query('SELECT MIN(id) AS m FROM users')->fetch()['m'] ?? null;
            if ($first) $pdo->exec("UPDATE users SET role = 'admin' WHERE id = " . (int)$first);
        }
        $add('profiles', 'in_explore', 'TINYINT(1) NOT NULL DEFAULT 0');   // opt in: only people who switch it on are listed in Explore
        $add('profiles', 'cover_img', 'INT NULL');
        foreach (['hidden_from', 'hidden_to', 'deleted_all'] as $c) $add('messages', $c, 'TINYINT(1) NOT NULL DEFAULT 0');
        $add('messages', 'edited_at', 'INT NULL');
        $pdo->exec(DB_DRIVER === 'sqlite'
            ? 'CREATE TABLE IF NOT EXISTS contact_names (user_id INTEGER NOT NULL, contact_id INTEGER NOT NULL, name VARCHAR(80) NOT NULL,
                PRIMARY KEY (user_id, contact_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE)'
            : 'CREATE TABLE IF NOT EXISTS contact_names (user_id INT UNSIGNED NOT NULL, contact_id INT UNSIGNED NOT NULL, name VARCHAR(80) NOT NULL,
                PRIMARY KEY (user_id, contact_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        // Pages people add to a notebook themselves (a title, an icon and some writing)
        $pdo->exec(DB_DRIVER === 'sqlite'
            ? 'CREATE TABLE IF NOT EXISTS nb_pages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, notebook_id INTEGER NOT NULL, title VARCHAR(40) NOT NULL,
                emoji VARCHAR(16) NOT NULL DEFAULT \'\', body TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE)'
            : 'CREATE TABLE IF NOT EXISTS nb_pages (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NOT NULL, notebook_id INT UNSIGNED NOT NULL, title VARCHAR(40) NOT NULL,
                emoji VARCHAR(16) NOT NULL DEFAULT \'\', body TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    } catch (PDOException $e) {
        error_log('Could not add roles / chat editing columns: ' . $e->getMessage());
    }

    // Emojis need utf8mb4. Hosts like InfinityFree often create the tables as plain utf8 (3 bytes per character), where an
    // emoji is refused or turned into "?". Convert any such table once; a table the host refuses to convert is left as it was.
    if (DB_DRIVER !== 'sqlite') {
        try {
            $pdo->exec('ALTER DATABASE `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        } catch (PDOException $e) {
            error_log('Could not change the database character set: ' . $e->getMessage());
        }
        try {
            $old = $pdo->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_COLLATION NOT LIKE 'utf8mb4%'")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($old as $t) {
                try {
                    $pdo->exec('ALTER TABLE `' . str_replace('`', '', (string)$t) . '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
                } catch (PDOException $e) {
                    error_log("Could not convert $t to utf8mb4: " . $e->getMessage());
                }
            }
        } catch (PDOException $e) {
            error_log('Could not check table character sets: ' . $e->getMessage());
        }
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

/**
 * Roles. The owner is whoever's email is in ADMIN_EMAILS (config.php): always an admin and can't be changed.
 * Other people have a role stored on their account: 'admin' (full Users page), 'subadmin' (can only look at the Users page) or 'user'.
 */
function is_owner(int $uid): bool
{
    $admins = defined('ADMIN_EMAILS') ? array_map('strtolower', ADMIN_EMAILS) : [];
    if (!$admins) return false;
    $row = q('SELECT email FROM users WHERE id = ?', [$uid])->fetch();
    return $row && in_array(strtolower($row['email']), $admins, true);
}

function user_role(int $uid): string
{
    if (is_owner($uid)) return 'admin';
    try {
        $r = (string)(q('SELECT role FROM users WHERE id = ?', [$uid])->fetch()['role'] ?? 'user');
    } catch (PDOException $e) {   // role column couldn't be added on this host
        return 'user';
    }
    return in_array($r, ['admin', 'subadmin'], true) ? $r : 'user';
}

/** May this user change accounts on admin.php (edit, delete, verify, roles)? */
function is_admin(int $uid): bool
{
    return user_role($uid) === 'admin';
}

/** May this user open admin.php? Admins can change things there, sub admins can only look. */
function can_view_users(int $uid): bool
{
    return user_role($uid) !== 'user';
}

/** The name this user gave a contact ('' = none, the real name is used). */
function contact_name(int $uid, int $contact): string
{
    try {
        return (string)(q('SELECT name FROM contact_names WHERE user_id = ? AND contact_id = ?', [$uid, $contact])->fetch()['name'] ?? '');
    } catch (PDOException $e) {
        return '';
    }
}

/** How many chat messages this user hasn't read yet (0 if the messages table couldn't be made on this host). */
function chat_unread(int $uid): int
{
    try {
        return (int)q('SELECT COUNT(*) AS n FROM messages WHERE to_id = ? AND is_read = 0 AND hidden_to = 0', [$uid])->fetch()['n'];
    } catch (PDOException $e) {
        return 0;
    }
}

/** Create the rows every new user starts with. */
function create_user_defaults(int $uid): void
{
    q('INSERT INTO settings (user_id, income, goal, note) VALUES (?, 0, 0, ?)', [$uid, 'Tiny steps still count.']);
    for ($d = 0; $d < 7; $d++) {
        q('INSERT INTO study_plan (user_id, weekday) VALUES (?, ?)', [$uid, $d]);
    }
}
