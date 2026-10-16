<?php
// Problems people reported with the website. Only admins and sub admins can open this page (the "Reports" button in the top bar).
// Nothing here is a message: reports are saved, emailed to ADMIN_EMAILS and listed here, and nobody else ever sees them.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';

$uid = require_login();
$canEdit = is_admin($uid);
if (!can_view_users($uid)) {
    http_response_code(403);
    app_top('Not allowed', ['eyebrow' => 'Your notebook', 'h1' => 'Not allowed']); ?>
    <p class="auth-sub">This page is only for the site's admins.</p>
    <p class="auth-alt"><a class="btn" href="index.php">Back to your planner</a></p>
<?php
    app_bottom();
    exit;
}

$msg = '';
$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$canEdit) {
    http_response_code(403);
    $err = 'A sub admin can only look at the reports.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!check_csrf($_POST['csrf'] ?? null)) $err = 'Your session expired. Please try again.';
    else {
        q('UPDATE reports SET resolved = ? WHERE id = ?', [!empty($_POST['on']) ? 1 : 0, (int)($_POST['report'] ?? 0)]);
        $msg = !empty($_POST['on']) ? 'Report marked as done.' : 'Report reopened.';
    }
}

try {
    $reports = q('SELECT r.id, r.message, r.resolved, r.created_at, f.name AS fname, f.email AS femail
        FROM reports r JOIN users f ON f.id = r.reporter_id ORDER BY r.resolved, r.id DESC LIMIT 100')->fetchAll();
} catch (PDOException $e) {   // reports table couldn't be made on this host
    $reports = [];
}

function when(?string $ts): string
{
    if (!$ts) return '—';
    $d = new DateTime($ts, new DateTimeZone(DB_DRIVER === 'sqlite' ? 'UTC' : date_default_timezone_get()));
    return $d->setTimezone(new DateTimeZone(date_default_timezone_get()))->format('j M Y, H:i');
}

app_top('Reports', ['active' => 'reports', 'eyebrow' => 'Your notebook', 'h1' => 'Reports']); ?>
    <?php if ($msg): ?><div class="formmsg ok" role="status"><?= h($msg) ?></div><?php endif; ?>
    <?php if ($err): ?><div class="formmsg err" role="alert"><?= h($err) ?></div><?php endif; ?>
    <?php if (!$reports): ?><p class="auth-sub">Nobody has reported a problem.</p><?php else: ?>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>From</th><th>Problem</th><th>When</th><?php if ($canEdit): ?><th></th><?php endif; ?></tr></thead>
        <tbody>
        <?php foreach ($reports as $r): ?>
          <tr<?= (int)$r['resolved'] ? ' style="opacity:.55"' : '' ?>>
            <td><?= h($r['fname']) ?><br><span class="email"><?= h($r['femail']) ?></span></td>
                        <td style="white-space:pre-wrap"><?= h($r['message']) ?></td>
            <td><?= h(when($r['created_at'])) ?></td>
            <?php if ($canEdit): ?>
            <td class="admin-acts"><form method="post" class="inline">
              <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="report" value="<?= (int)$r['id'] ?>"><input type="hidden" name="on" value="<?= (int)$r['resolved'] ? 0 : 1 ?>">
              <button class="btn sm"><?= (int)$r['resolved'] ? 'Reopen' : 'Done' ?></button>
            </form></td>
            <?php endif; ?>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php endif; ?>
<?php app_bottom();
