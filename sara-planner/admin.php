<?php
// Every account on the site: name, email, when they signed up and last logged in.
// Only the emails listed in ADMIN_EMAILS (config.php) can open this page.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';

$uid = require_login();
if (!is_admin($uid)) {
    http_response_code(403);
    app_top('Not allowed', ['eyebrow' => 'Your notebook', 'h1' => 'Not allowed']); ?>
    <p class="auth-sub">This page is only for the site owner.</p>
    <p class="auth-alt"><a class="btn" href="index.php">Back to your planner</a></p>
<?php
    app_bottom();
    exit;
}

$msg = '';
$err = '';
$editId = isset($_GET['edit']) && ctype_digit((string)$_GET['edit']) ? (int)$_GET['edit'] : 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $do = (string)($_POST['do'] ?? '');
    $target = isset($_POST['id']) && ctype_digit((string)$_POST['id']) ? (int)$_POST['id'] : 0;
    $row = $target ? q('SELECT id, name, email FROM users WHERE id = ?', [$target])->fetch() : false;
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $err = 'Your session expired. Please try again.';
    } elseif (!$row) {
        $err = 'That account no longer exists.';
    } elseif ($do === 'delete') {
        if ($target === $uid) $err = 'Use "Delete my account" on your profile to remove your own account.';
        elseif (is_admin($target)) $err = 'Admin accounts cannot be deleted here.';
        else {
            q('DELETE FROM users WHERE id = ?', [$target]);   // everything that belongs to them goes with it
            $msg = 'Deleted ' . $row['name'] . ' (' . $row['email'] . ').';
        }
    } elseif ($do === 'save') {
        $name = trim((string)($_POST['name'] ?? ''));
        $email = strtolower(trim((string)($_POST['email'] ?? '')));
        $pass = (string)($_POST['password'] ?? '');
        $editId = $target;
        if ($name === '' || mb_strlen($name) > 80) $err = 'Enter a name (up to 80 characters).';
        elseif (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) $err = 'Enter a valid email address.';
        elseif ($pass !== '' && strlen($pass) < 8) $err = 'A new password needs at least 8 characters.';
        elseif (q('SELECT 1 FROM users WHERE email = ? AND id <> ?', [$email, $target])->fetch()) $err = 'Another account already uses that email.';
        else {
            q('UPDATE users SET name = ?, email = ? WHERE id = ?', [$name, $email, $target]);
            if ($pass !== '') q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $target]);
            $msg = 'Saved ' . $name . '.';
            $editId = 0;
        }
    }
}

try {
    $users = q('SELECT id, name, email, created_at, last_login FROM users ORDER BY created_at DESC, id DESC')->fetchAll();
} catch (PDOException $e) {   // last_login column couldn't be added on this host
    $users = q('SELECT id, name, email, created_at, NULL AS last_login FROM users ORDER BY created_at DESC, id DESC')->fetchAll();
}

function when(?string $ts): string
{
    return $ts ? date('j M Y, H:i', strtotime($ts)) : '—';
}

app_top('Users', ['active' => 'admin', 'eyebrow' => 'Your notebook', 'h1' => 'Users']); ?>
    <?php if ($msg): ?><div class="formmsg ok" role="status"><?= h($msg) ?></div><?php endif; ?>
    <?php if ($err): ?><div class="formmsg err" role="alert"><?= h($err) ?></div><?php endif; ?>
    <p class="auth-sub"><span class="admin-count"><?= count($users) ?></span> <?= count($users) === 1 ? 'account' : 'accounts' ?> in this database.</p>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Name</th><th>Email</th><th>Signed up</th><th>Last login</th><th></th></tr></thead>
        <tbody>
        <?php foreach ($users as $u): $uidRow = (int)$u['id']; ?>
          <?php if ($editId === $uidRow): ?>
          <tr class="admin-edit"><td colspan="5">
            <form method="post" class="auth-form admin-form" autocomplete="off">
              <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
              <input type="hidden" name="do" value="save"><input type="hidden" name="id" value="<?= $uidRow ?>">
              <label>Name<input name="name" value="<?= h($_POST['name'] ?? $u['name']) ?>" required maxlength="80"></label>
              <label>Email<input name="email" type="email" value="<?= h($_POST['email'] ?? $u['email']) ?>" required></label>
              <label>New password (leave empty to keep theirs)<input name="password" type="password" minlength="8" autocomplete="new-password"></label>
              <div class="xrow"><button class="btn primary">Save</button><a class="btn ghost" href="admin.php">Cancel</a></div>
            </form>
          </td></tr>
          <?php else: ?>
          <tr>
            <td><?= h($u['name']) ?></td>
            <td class="email"><?= h($u['email']) ?></td>
            <td><?= h(when($u['created_at'])) ?></td>
            <td><?= h(when($u['last_login'])) ?></td>
            <td class="admin-acts">
              <a class="btn sm" href="admin.php?edit=<?= $uidRow ?>">Edit</a>
              <?php if ($uidRow !== $uid && !is_admin($uidRow)): ?>
              <form method="post" class="inline" onsubmit="return confirm('Delete <?= h(addslashes($u['name'])) ?> and everything in their account for good?')">
                <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="do" value="delete"><input type="hidden" name="id" value="<?= $uidRow ?>">
                <button class="btn sm danger">Delete</button>
              </form>
              <?php endif; ?>
            </td>
          </tr>
          <?php endif; ?>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
<?php app_bottom();
