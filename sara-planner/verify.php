<?php
// Confirm a new account's email with the 6-digit code we sent through Gmail.
// If the email was typed wrong, it can be fixed here and a new code is sent.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/mail.php';

$uid = require_login(true);
if (!mail_configured() && !is_verified($uid)) {   // email sending was switched off: nothing to wait for
    q('UPDATE users SET email_verified = 1 WHERE id = ?', [$uid]);
}
if (is_verified($uid)) {
    header('Location: index.php');
    exit;
}
$user = q('SELECT name, email FROM users WHERE id = ?', [$uid])->fetch();

$error = (string)($_SESSION['verify_msg'] ?? '');   // from register.php, if the first email failed
$ok = '';
unset($_SESSION['verify_msg']);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $do = (string)($_POST['do'] ?? '');
    $row = q('SELECT code_hash, expires_at, sent_at, tries FROM email_codes WHERE user_id = ?', [$uid])->fetch();

    if (!check_csrf($_POST['csrf'] ?? null)) {
        $error = 'Your session expired. Please try again.';
    } elseif ($do === 'code') {
        $code = preg_replace('/\D/', '', (string)($_POST['code'] ?? ''));
        if (!$row || (int)$row['expires_at'] < time()) {
            $error = 'That code has run out. Click "Send a new code".';
        } elseif ((int)$row['tries'] >= 5) {
            $error = 'Too many wrong codes. Click "Send a new code".';
        } elseif (!password_verify($code, $row['code_hash'])) {
            q('UPDATE email_codes SET tries = tries + 1 WHERE user_id = ?', [$uid]);
            $error = "That code isn't right. Check the latest email we sent.";
        } else {
            q('UPDATE users SET email_verified = 1 WHERE id = ?', [$uid]);
            q('DELETE FROM email_codes WHERE user_id = ?', [$uid]);
            header('Location: index.php');
            exit;
        }
    } elseif ($do === 'resend' || $do === 'change') {
        if ($row && (int)$row['sent_at'] > time() - 60) {
            $error = 'Please wait a minute before asking for another code.';
        } else {
            if ($do === 'change') {
                $email = strtolower(trim((string)($_POST['email'] ?? '')));
                if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) {
                    $error = 'Enter a valid email address.';
                } elseif (q('SELECT 1 FROM users WHERE email = ? AND id <> ?', [$email, $uid])->fetch()) {
                    $error = 'There is already an account with that email.';
                } else {
                    q('UPDATE users SET email = ? WHERE id = ?', [$email, $uid]);
                    $user['email'] = $email;
                }
            }
            if ($error === '') {
                $error = send_verify_code($uid, $user['email'], $user['name']);
                if ($error === '') $ok = 'We sent a new code to ' . $user['email'] . '.';
            }
        }
    }
}

auth_top('Confirm your email'); ?>
    <h1>Check your email</h1>
    <p class="auth-sub">We sent a 6-digit code to <b><?= h($user['email']) ?></b>. Type it below to open your planner.
      It can take a minute, and sometimes lands in Spam.</p>
    <?php if ($error): ?><div class="formmsg err" role="alert"><?= h($error) ?></div><?php endif; ?>
    <?php if ($ok): ?><div class="formmsg ok" role="status"><?= h($ok) ?></div><?php endif; ?>
    <form method="post" class="auth-form">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="do" value="code">
      <label for="code">Code<input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]*" maxlength="7" required autofocus></label>
      <button class="btn primary">Confirm email</button>
    </form>
    <form method="post" class="auth-alt">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="do" value="resend">
      Didn't get it? <button class="linkbtn" style="font-size:14px">Send a new code</button>
    </form>
    <details class="auth-alt">
      <summary style="cursor:pointer">Wrong email? Change it</summary>
      <form method="post" class="auth-form" style="margin-top:12px">
        <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
        <input type="hidden" name="do" value="change">
        <label for="email">Your email<input id="email" name="email" type="email" value="<?= h($user['email']) ?>" autocomplete="email" required></label>
        <button class="btn">Save and send the code there</button>
      </form>
    </details>
    <form method="post" action="logout.php" class="auth-alt">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <button class="linkbtn" style="font-size:14px">Log out</button>
    </form>
<?php auth_bottom();
