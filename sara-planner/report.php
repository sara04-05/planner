<?php
// Report a problem with the website to the site's admins (the "!" button in the top bar).
// The report is saved (admins read it on admin.php) and emailed to the addresses in ADMIN_EMAILS (config.php). Nobody else sees it.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/mail.php';
require __DIR__ . '/layout.php';

$uid = require_login();
if (can_view_users($uid)) {   // admins don't make reports, they read them
    header('Location: admin.php#reports');
    exit;
}

$err = '';
$sent = false;
$details = trim((string)($_POST['details'] ?? ''));
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!check_csrf($_POST['csrf'] ?? null)) $err = 'Your session expired. Please try again.';
    elseif ($details === '') $err = 'Tell the admins what went wrong.';
    elseif (mb_strlen($details) > 1000) $err = 'Keep it under 1000 characters.';
    elseif ((int)q('SELECT COUNT(*) n FROM reports WHERE reporter_id = ? AND resolved = 0', [$uid])->fetch()['n'] >= 5) $err = 'You already have several open reports. The admins will look at them soon.';
    else {
        // a problem report has no other account in it: the "reported" account is the sender themselves
        q('INSERT INTO reports (reporter_id, target_id, reason, details) VALUES (?, ?, ?, ?)', [$uid, $uid, 'problem', $details]);
        $me = person($uid);
        $admins = defined('ADMIN_EMAILS') ? ADMIN_EMAILS : [];
        if ($admins && mail_configured()) {
            $text = "A user reported a problem on Splanner.\n\nFrom: " . $me['name'] . ' <' . $me['email'] . ">\nProblem: " . $details . "\n\nSee all reports on the Users page (admin.php).\n";
            foreach ($admins as $email) {
                try {
                    send_mail((string)$email, 'Splanner problem: ' . $me['name'], $text);
                } catch (RuntimeException $e) {
                    error_log('Report email: ' . $e->getMessage());   // the report is still saved and shown on admin.php
                }
            }
        }
        $sent = true;
    }
}

app_top('Report a problem', ['active' => 'report', 'h1' => 'Report a problem']); ?>
    <?php if ($err): ?><div class="formmsg err" role="alert"><?= h($err) ?></div><?php endif; ?>
    <?php if ($sent): ?>
    <div class="formmsg ok" role="status">Thank you. Your report was sent to the admins.</div>
    <p class="auth-alt"><a class="btn" href="index.php">Back to my planner</a></p>
    <?php else: ?>
    <form method="post" class="auth-form" autocomplete="off">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <label>What went wrong?<textarea name="details" rows="5" maxlength="1000" required><?= h($details) ?></textarea></label>
      <div class="xrow"><button class="btn primary">Send to the admins</button><a class="btn ghost" href="index.php">Cancel</a></div>
    </form>
    <?php endif; ?>
<?php app_bottom();
