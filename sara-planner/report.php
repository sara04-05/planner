<?php
// Report a problem with the website. The report is saved for the admins (they read it with the Reports button in the top bar)
// and emailed to the ADMIN_EMAILS in config.php. It is never sent as a message or notification to anyone.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/mail.php';
require __DIR__ . '/notebook.php';

/** Where emailed reports go: CONTACT_EMAIL in config.php, else every ADMIN_EMAILS address, else the Gmail account used for sending. */
function report_emails(): array
{
    if (defined('CONTACT_EMAIL') && CONTACT_EMAIL !== '') return [CONTACT_EMAIL];
    if (defined('ADMIN_EMAILS') && ADMIN_EMAILS) return array_values(ADMIN_EMAILS);
    return defined('GMAIL_USER') && GMAIL_USER !== '' ? [GMAIL_USER] : [];
}

$uid = require_login(true);
if (can_view_users($uid)) {   // admins don't make reports, they read them
    header('Location: reports.php');
    exit;
}
$me = person($uid);
$error = '';
$sent = '';
$text = (string)($_POST['message'] ?? '');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $text = trim($text);
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $error = 'Your session expired. Please try again.';
    } elseif (mb_strlen($text) < 5) {
        $error = 'Please tell us a little about the problem.';
    } elseif (mb_strlen($text) > 2000) {
        $error = 'That is too long. Please keep it under 2000 characters.';
    } elseif ((int)q('SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ? AND created_at > ?', [$uid, date('Y-m-d H:i:s', time() - 3600 + (DB_DRIVER === 'sqlite' ? -(int)date('Z') : 0))])->fetch()['n'] >= 10) {
        $error = 'You have sent a lot of reports. Please wait a while and try again.';
    } else {
        q('INSERT INTO reports (reporter_id, message) VALUES (?, ?)', [$uid, $text]);
        if (mail_configured()) {
            $row = q('SELECT email FROM users WHERE id = ?', [$uid])->fetch();
            foreach (report_emails() as $to) {
                try {
                    send_mail($to, 'Splanner problem report from ' . ($me['name'] ?? 'a user'),
                        'From: ' . ($me['name'] ?? '') . ' <' . ($row['email'] ?? '') . ">\nAccount id: $uid\n\n" . $text . "\n\nAll reports: the Reports button in Splanner.\n");
                } catch (RuntimeException $e) {
                    error_log('Problem report email failed: ' . $e->getMessage());   // still saved for the admins
                }
            }
        }
        $sent = 'Thank you! Your report was sent to the admins.';
        $text = '';
    }
}

auth_top('Report a problem'); ?>
    <h1>Report a problem</h1>
    <p class="auth-sub">Something wrong with the website? Tell us. Only the admins see your report.</p>
    <?php if ($error): ?><div class="formmsg err" role="alert"><?= h($error) ?></div><?php endif; ?>
    <?php if ($sent): ?><div class="formmsg ok" role="status"><?= h($sent) ?></div><?php endif; ?>
    <form method="post" class="auth-form">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <label for="message">What went wrong?<textarea id="message" name="message" rows="6" maxlength="2000" required placeholder="What did you do, and what happened?"><?= h($text) ?></textarea></label>
      <button class="btn primary">Send report</button>
    </form>
    <p class="auth-alt"><a href="index.php">Back to my planner</a></p>
<?php auth_bottom();
