<?php
// Report an account to the site's admins: report.php?id=<user id>.
// The report is saved (admins see it on admin.php) and emailed to the addresses in ADMIN_EMAILS (config.php). Nobody else sees it.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/mail.php';
require __DIR__ . '/layout.php';

$uid = require_login();
if (can_view_users($uid)) {   // admins don't make reports, they read them
    header('Location: reports.php');
    exit;
}
$target = isset($_REQUEST['id']) && ctype_digit((string)$_REQUEST['id']) ? (int)$_REQUEST['id'] : 0;
$person = $target && $target !== $uid ? person($target) : null;
if (!$person) {
    http_response_code(404);
    app_top('Not found', ['active' => 'explore', 'h1' => 'Not found']); ?>
    <p class="auth-sub">That account doesn't exist, or it is your own.</p>
    <p class="auth-alt"><a class="btn" href="explore.php">Back to Explore</a></p>
<?php
    app_bottom();
    exit;
}

const REPORT_REASONS = ['spam' => 'Spam or fake account', 'harassment' => 'Harassment or bullying', 'inappropriate' => 'Inappropriate content', 'impersonation' => 'Pretending to be someone else', 'other' => 'Something else'];

$err = '';
$sent = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $reason = (string)($_POST['reason'] ?? '');
    $details = trim((string)($_POST['details'] ?? ''));
    if (!check_csrf($_POST['csrf'] ?? null)) $err = 'Your session expired. Please try again.';
    elseif (!isset(REPORT_REASONS[$reason])) $err = 'Pick a reason.';
    elseif (mb_strlen($details) > 1000) $err = 'Keep the details under 1000 characters.';
    elseif ((int)q('SELECT COUNT(*) n FROM reports WHERE reporter_id = ? AND target_id = ? AND resolved = 0', [$uid, $target])->fetch()['n'] > 0) $err = 'You already reported this account. The admins will look at it.';
    else {
        q('INSERT INTO reports (reporter_id, target_id, reason, details) VALUES (?, ?, ?, ?)', [$uid, $target, $reason, $details]);
        $rid = (int)db()->lastInsertId();
        $me = person($uid);

        // Only the admins get the report: emailed to the ADMIN_EMAILS in config.php and listed on admin.php. It is never shown as a message or notification to anyone else.
        $admins = defined('ADMIN_EMAILS') ? ADMIN_EMAILS : [];
        if ($admins && mail_configured()) {
            $text = "A user reported an account on Splanner.\n\n"
                . 'Reported: ' . $person['name'] . ' <' . $person['email'] . "> (id $target)\n"
                . 'Reported by: ' . $me['name'] . ' <' . $me['email'] . ">\n"
                . 'Reason: ' . REPORT_REASONS[$reason] . "\n"
                . 'Details: ' . ($details !== '' ? $details : '(none)') . "\n\n"
                . "See all reports on the Reports page (reports.php).\n";
            foreach ($admins as $email) {
                try {
                    send_mail((string)$email, 'Splanner report: ' . $person['name'], $text);
                } catch (RuntimeException $e) {
                    error_log('Report email: ' . $e->getMessage());   // the report is still saved and shown on admin.php
                }
            }
        }
        $sent = true;
    }
}

app_top('Report ' . $person['name'], ['active' => 'explore', 'eyebrow' => 'Your notebook', 'h1' => 'Report ' . $person['name']]); ?>
    <?php if ($err): ?><div class="formmsg err" role="alert"><?= h($err) ?></div><?php endif; ?>
    <?php if ($sent): ?>
    <div class="formmsg ok" role="status">Thank you. Your report was sent to the admins.</div>
    <p class="auth-alt"><a class="btn" href="explore.php">Back to Explore</a></p>
    <?php else: ?>
    <p class="auth-sub">Tell the admins what is wrong with this account. Only the admins see your report.</p>
    <form method="post" class="auth-form" autocomplete="off">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="id" value="<?= $target ?>">
      <label>Reason<select name="reason" required>
        <?php foreach (REPORT_REASONS as $k => $label): ?><option value="<?= $k ?>"<?= ($_POST['reason'] ?? '') === $k ? ' selected' : '' ?>><?= h($label) ?></option><?php endforeach; ?>
      </select></label>
      <label>Details (optional)<textarea name="details" rows="4" maxlength="1000"><?= h($_POST['details'] ?? '') ?></textarea></label>
      <div class="xrow"><button class="btn primary">Send report</button><a class="btn ghost" href="explore.php">Cancel</a></div>
    </form>
    <?php endif; ?>
<?php app_bottom();
