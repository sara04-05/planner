<?php
// Change your own password: type your current password, then the new one twice.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';

$uid = require_login(true);
$error = '';
$done = isset($_GET['done']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = q('SELECT password_hash FROM users WHERE id = ?', [$uid])->fetch();
    $new  = (string)($_POST['new_password'] ?? '');
    $new2 = (string)($_POST['new_password2'] ?? '');
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $error = 'Your session expired. Please try again.';
    } elseif (!$user || !password_verify((string)($_POST['password'] ?? ''), $user['password_hash'])) {
        sleep(1);
        $error = "Your current password isn't right.";
    } elseif (strlen($new) < 8) {
        $error = 'Your new password needs at least 8 characters.';
    } elseif ($new !== $new2) {
        $error = "The two new passwords don't match.";
    } elseif (hash_equals((string)($_POST['password'] ?? ''), $new)) {
        $error = 'Your new password must be different from the old one.';
    } else {
        q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $uid]);
        session_regenerate_id(true);
        header('Location: change-password.php?done=1');
        exit;
    }
}

auth_top('Change password'); ?>
    <h1>Change your password</h1>
    <p class="auth-sub">Type your current password, then choose a new one.</p>
    <?php if ($error): ?><div class="formmsg err" role="alert"><?= h($error) ?></div><?php endif; ?>
    <?php if ($done): ?><div class="formmsg ok" role="status">Your password was changed.</div><?php endif; ?>
    <form method="post" class="auth-form">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <label for="password">Current password<input id="password" name="password" type="password" autocomplete="current-password" required></label>
      <label for="new_password">New password<input id="new_password" name="new_password" type="password" autocomplete="new-password" required minlength="8"></label>
      <label for="new_password2">Repeat new password<input id="new_password2" name="new_password2" type="password" autocomplete="new-password" required minlength="8"></label>
      <button class="btn primary">Change my password</button>
    </form>
    <p class="auth-alt"><a href="index.php?tab=profile&amp;ptab=settings">Back to settings</a></p>
<?php auth_bottom();
