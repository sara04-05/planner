<?php
// Change your own password: type the current one, then the new one twice.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';

$uid = require_login(true);
$error = '';
$done = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = q('SELECT password_hash FROM users WHERE id = ?', [$uid])->fetch();
    $new = (string)($_POST['new'] ?? '');
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $error = 'Your session expired. Please try again.';
    } elseif (!$user || !password_verify((string)($_POST['current'] ?? ''), $user['password_hash'])) {
        sleep(1);   // slows down password guessing
        $error = "Your current password isn't right.";
    } elseif (strlen($new) < 8) {
        $error = 'Your new password needs at least 8 characters.';
    } elseif ($new !== (string)($_POST['new2'] ?? '')) {
        $error = "The two new passwords don't match.";
    } else {
        q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $uid]);
        session_regenerate_id(true);
        $done = true;
    }
}

auth_top('Change password'); ?>
    <h1>Change your password</h1>
    <?php if ($error): ?><div class="formmsg err" role="alert"><?= h($error) ?></div><?php endif; ?>
    <?php if ($done): ?>
    <div class="formmsg ok" role="status">Your password was changed.</div>
    <p class="auth-alt"><a class="btn" href="index.php?tab=profile">Back to my profile</a></p>
    <?php else: ?>
    <form method="post" class="auth-form">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <label for="current">Current password<input id="current" name="current" type="password" autocomplete="current-password" required></label>
      <label for="new">New password<input id="new" name="new" type="password" autocomplete="new-password" minlength="8" required></label>
      <label for="new2">New password again<input id="new2" name="new2" type="password" autocomplete="new-password" minlength="8" required></label>
      <button class="btn primary">Change password</button>
    </form>
    <p class="auth-alt"><a href="index.php?tab=profile">Cancel</a></p>
    <?php endif; ?>
<?php auth_bottom();
