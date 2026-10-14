<?php
// Delete your own account: type your password, and your account and everything in it is removed for good.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';

$uid = require_login(true);
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = q('SELECT password_hash FROM users WHERE id = ?', [$uid])->fetch();
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $error = 'Your session expired. Please try again.';
    } elseif (!$user || !password_verify((string)($_POST['password'] ?? ''), $user['password_hash'])) {
        sleep(1);
        $error = "That password isn't right.";
    } else {
        q('DELETE FROM users WHERE id = ?', [$uid]);   // everything else (planner, notebooks, messages, friends…) goes with it
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        header('Location: welcome.php?deleted=1');
        exit;
    }
}

auth_top('Delete account'); ?>
    <h1>Delete your account</h1>
    <p class="auth-sub">This logs you out and permanently removes your account, your planner, notebooks, pictures, messages and friends. It cannot be undone.</p>
    <?php if ($error): ?><div class="formmsg err" role="alert"><?= h($error) ?></div><?php endif; ?>
    <form method="post" class="auth-form">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <label for="password">Type your password to confirm<input id="password" name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn danger">Delete my account for good</button>
    </form>
    <p class="auth-alt"><a href="index.php?tab=profile">No, keep my account</a></p>
<?php auth_bottom();
