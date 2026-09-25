<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';

if (current_user_id()) {
    header('Location: index.php');
    exit;
}

$errors = [];
$name = trim((string)($_POST['name'] ?? ''));
$email = strtolower(trim((string)($_POST['email'] ?? '')));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pass = (string)($_POST['password'] ?? '');
    $pass2 = (string)($_POST['password2'] ?? '');

    if (!check_csrf($_POST['csrf'] ?? null)) $errors[] = 'Your session expired. Please try again.';
    if ($name === '' || mb_strlen($name) > 80) $errors[] = 'Enter your name (up to 80 characters).';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) $errors[] = 'Enter a valid email address.';
    if (strlen($pass) < 8) $errors[] = 'Your password needs at least 8 characters.';
    if ($pass !== $pass2) $errors[] = "The two passwords don't match.";

    if (!$errors && q('SELECT 1 FROM users WHERE email = ?', [$email])->fetch()) {
        $errors[] = 'There is already an account with that email. Log in instead.';
    }

    if (!$errors) {
        $pdo = db();
        $pdo->beginTransaction();
        q('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [$name, $email, password_hash($pass, PASSWORD_DEFAULT)]);
        $uid = (int)$pdo->lastInsertId();
        create_user_defaults($uid);
        $pdo->commit();
        login_user($uid);
        header('Location: index.php');
        exit;
    }
}

auth_top('Create an account'); ?>
    <h1>Create your planner</h1>
    <p class="auth-sub">Your planner is private. Only you can see what you add.</p>
    <?php if ($errors): ?>
      <div class="formmsg err" role="alert"><?= implode('<br>', array_map('h', $errors)) ?></div>
    <?php endif; ?>
    <form method="post" class="auth-form" novalidate>
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <label for="name">Name<input id="name" name="name" value="<?= h($name) ?>" autocomplete="name" required maxlength="80"></label>
      <label for="email">Email<input id="email" name="email" type="email" value="<?= h($email) ?>" autocomplete="email" required></label>
      <label for="password">Password<input id="password" name="password" type="password" autocomplete="new-password" required minlength="8"></label>
      <label for="password2">Repeat password<input id="password2" name="password2" type="password" autocomplete="new-password" required minlength="8"></label>
      <button class="btn primary">Create account</button>
    </form>
    <p class="auth-alt">Already have an account? <a href="login.php">Log in</a></p>
<?php auth_bottom();
