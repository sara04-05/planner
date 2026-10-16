<?php
// Report a problem with the website: the owner is told in Splanner (a message) or by email, whichever the person picks.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/mail.php';
require __DIR__ . '/notebook.php';

/** The account that receives problem reports: the owner (ADMIN_EMAILS), else the first admin, else the oldest account. */
function report_owner(int $except): ?int
{
    foreach (defined('ADMIN_EMAILS') ? ADMIN_EMAILS : [] as $e) {
        $r = q('SELECT id FROM users WHERE LOWER(email) = ?', [strtolower($e)])->fetch();
        if ($r && (int)$r['id'] !== $except) return (int)$r['id'];
    }
    try {
        $r = q("SELECT id FROM users WHERE role = 'admin' AND id <> ? ORDER BY id LIMIT 1", [$except])->fetch();
        if ($r) return (int)$r['id'];
    } catch (PDOException $e) {
    }
    $r = q('SELECT id FROM users WHERE id <> ? ORDER BY id LIMIT 1', [$except])->fetch();
    return $r ? (int)$r['id'] : null;
}

/** Where emailed reports go: CONTACT_EMAIL in config.php, else the first ADMIN_EMAILS entry, else the Gmail account used for sending. */
function report_email(): string
{
    if (defined('CONTACT_EMAIL') && CONTACT_EMAIL !== '') return CONTACT_EMAIL;
    if (defined('ADMIN_EMAILS') && ADMIN_EMAILS) return ADMIN_EMAILS[0];
    return defined('GMAIL_USER') ? GMAIL_USER : '';
}

$uid = require_login(true);
$me = person($uid);
$owner = report_owner($uid);
$toEmail = report_email();
$canMail = mail_configured() && $toEmail !== '';
$canChat = $owner !== null;
$error = '';
$sent = '';
$via = (string)($_POST['via'] ?? ($canChat ? 'splanner' : 'email'));
$text = (string)($_POST['message'] ?? '');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $text = trim($text);
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $error = 'Your session expired. Please try again.';
    } elseif (mb_strlen($text) < 5) {
        $error = 'Please tell us a little about the problem.';
    } elseif (mb_strlen($text) > 2000) {
        $error = 'That is too long. Please keep it under 2000 characters.';
    } elseif ($via === 'splanner' && $canChat) {
        $recent = (int)q('SELECT COUNT(*) AS n FROM messages WHERE from_id = ? AND sent_at > ?', [$uid, time() - 3600])->fetch()['n'];
        if ($recent >= 10) {
            $error = 'You have sent a lot of messages. Please wait a while and try again.';
        } else {
            $body = '🛠 Problem report: ' . $text;
            q('INSERT INTO messages (from_id, to_id, body, sent_at) VALUES (?, ?, ?, ?)', [$uid, $owner, msg_encrypt($body), time()]);
            notify_replace($owner, 'msg:' . $uid, ($me['name'] ?? 'Someone') . ' reported a problem', 'messages.php?with=' . $uid);
            $sent = 'Thank you! Your report was sent in Splanner. Replies will show up in your Messages.';
            $text = '';
        }
    } elseif ($via === 'email' && $canMail) {
        $row = q('SELECT email FROM users WHERE id = ?', [$uid])->fetch();
        try {
            send_mail($toEmail, 'Splanner problem report from ' . ($me['name'] ?? 'a user'),
                "From: " . ($me['name'] ?? '') . ' <' . ($row['email'] ?? '') . ">\nAccount id: $uid\n\n" . $text);
            $sent = 'Thank you! Your report was emailed. We will answer at ' . ($row['email'] ?? 'your email') . '.';
            $text = '';
        } catch (RuntimeException $e) {
            error_log('Problem report email failed: ' . $e->getMessage());
            $error = "The email couldn't be sent. Try sending it through Splanner instead.";
        }
    } else {
        $error = 'That way of contacting us is not available right now.';
    }
}

auth_top('Report a problem'); ?>
    <h1>Report a problem</h1>
    <p class="auth-sub">Something wrong with the website? Tell us and choose how you want to reach us.</p>
    <?php if ($error): ?><div class="formmsg err" role="alert"><?= h($error) ?></div><?php endif; ?>
    <?php if ($sent): ?><div class="formmsg ok" role="status"><?= h($sent) ?></div><?php endif; ?>
    <form method="post" class="auth-form">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <fieldset class="covers">
        <legend>Contact us</legend>
        <label class="check"><input type="radio" name="via" value="splanner"<?= $via === 'splanner' ? ' checked' : '' ?><?= $canChat ? '' : ' disabled' ?>> Via Splanner (a message in your Messages)</label>
        <label class="check"><input type="radio" name="via" value="email"<?= $via === 'email' ? ' checked' : '' ?><?= $canMail ? '' : ' disabled' ?>> Via email<?= $canMail ? '' : ' (not available on this site)' ?></label>
      </fieldset>
      <label for="message">What went wrong?<textarea id="message" name="message" rows="6" maxlength="2000" required placeholder="What did you do, and what happened?"><?= h($text) ?></textarea></label>
      <button class="btn primary">Send report</button>
    </form>
    <p class="auth-alt"><a href="index.php">Back to my planner</a></p>
<?php auth_bottom();
