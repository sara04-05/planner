<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';

if (current_user_id()) {
    header('Location: index.php');
    exit;
}

$error = '';
$email = strtolower(trim((string)($_POST['email'] ?? '')));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $error = 'Your session expired. Please try again.';
    } else {
        $user = q('SELECT id, password_hash FROM users WHERE email = ?', [$email])->fetch();
        if ($user && password_verify((string)($_POST['password'] ?? ''), $user['password_hash'])) {
            if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
                q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash((string)$_POST['password'], PASSWORD_DEFAULT), $user['id']]);
            }
            login_user((int)$user['id']);
            header('Location: index.php');
            exit;
        }
        sleep(1); // slows down password guessing
        $error = "That email and password don't match an account.";
    }
}

auth_top('Log in'); ?>
    <h1>Welcome back</h1>
    <p class="auth-sub">Log in to open your planner.</p>
    <?php if ($error): ?>
      <div class="formmsg err" role="alert"><?= h($error) ?></div>
    <?php endif; ?>
    <form method="post" class="auth-form">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <label for="email">Email<input id="email" name="email" type="email" value="<?= h($email) ?>" autocomplete="email" required></label>
      <label for="password">Password<input id="password" name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn primary">Log in</button>
    </form>
    <p class="auth-alt">New here? <a href="register.php">Create an account</a></p>
<?php auth_bottom();
