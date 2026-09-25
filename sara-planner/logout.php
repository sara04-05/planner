<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

// Only log out on a POST with a valid token, so other sites can't log you out.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && check_csrf($_POST['csrf'] ?? null)) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
header('Location: login.php');
exit;
