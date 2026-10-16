<?php
// Every account on the site: name, email, role, when they signed up and last logged in.
// Roles: the owner (the email in ADMIN_EMAILS in config.php) and other admins can change accounts, give the blue verified tick and set roles;
// a sub admin can only look at the list; everybody else has no access.
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
$editId = isset($_GET['edit']) && ctype_digit((string)$_GET['edit']) ? (int)$_GET['edit'] : 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$canEdit) {
    http_response_code(403);
    $err = 'A sub admin can only look at the users.';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $do = (string)($_POST['do'] ?? '');
    $target = isset($_POST['id']) && ctype_digit((string)$_POST['id']) ? (int)$_POST['id'] : 0;
    $row = $target ? q('SELECT id, name, email FROM users WHERE id = ?', [$target])->fetch() : false;
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $err = 'Your session expired. Please try again.';
    } elseif (!$row) {
        $err = 'That account no longer exists.';
    } elseif ($do === 'verify') {
        $on = !empty($_POST['on']) ? 1 : 0;
        q('UPDATE users SET verified_badge = ? WHERE id = ?', [$on, $target]);
        $msg = $row['name'] . ($on ? ' is now verified.' : ' is no longer verified.');
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
            // role and verified tick: the owner's account can't be changed, and only the owner can take admin rights away from another admin
            $newRole = (string)($_POST['role'] ?? user_role($target));
            if (in_array($newRole, ['user', 'subadmin', 'admin'], true) && !is_owner($target) && $newRole !== user_role($target)) {
                if (user_role($target) === 'admin' && !is_owner($uid)) $err = 'Only the owner can take admin rights away from another admin.';
                else q('UPDATE users SET role = ? WHERE id = ?', [$newRole, $target]);
            }
            q('UPDATE users SET verified_badge = ? WHERE id = ?', [!empty($_POST['verified']) ? 1 : 0, $target]);
            if ($pass !== '') q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $target]);
            if (!$err) { $msg = 'Saved ' . $name . '.'; $editId = 0; }
        }
    }
}

try {
    $users = q('SELECT id, name, email, created_at, last_login, role, verified_badge FROM users ORDER BY created_at DESC, id DESC')->fetchAll();
} catch (PDOException $e) {   // last_login column couldn't be added on this host
    $users = q('SELECT id, name, email, created_at, NULL AS last_login, \'user\' AS role, 0 AS verified_badge FROM users ORDER BY created_at DESC, id DESC')->fetchAll();
}

function when(?string $ts): string
{
    if (!$ts) return '—';
    // SQLite stamps times in UTC; MySQL is already switched to the site's time zone in db.php
    $d = new DateTime($ts, new DateTimeZone(DB_DRIVER === 'sqlite' ? 'UTC' : date_default_timezone_get()));
    return $d->setTimezone(new DateTimeZone(date_default_timezone_get()))->format('j M Y, H:i');
}

app_top('Users', ['active' => 'admin', 'eyebrow' => 'Your notebook', 'h1' => 'Users']); ?>
    <?php if ($msg): ?><div class="formmsg ok" role="status"><?= h($msg) ?></div><?php endif; ?>
    <?php if ($err): ?><div class="formmsg err" role="alert"><?= h($err) ?></div><?php endif; ?>
    <p class="auth-sub"><span class="admin-count"><?= count($users) ?></span> <?= count($users) === 1 ? 'account' : 'accounts' ?> in this database.
      <?= $canEdit ? (is_owner($uid) ? 'You are the owner: you can edit accounts, give the verified tick and set roles.' : 'You are an admin: you can edit accounts, give the verified tick and set roles.') : 'You are a sub admin: you can look at the users but not change anything.' ?></p>
    <p class="hint2">Roles: Admin changes everything on this page · Sub admin can only look at it · User is everybody else.</p>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Signed up</th><th>Last login</th><?php if ($canEdit): ?><th></th><?php endif; ?></tr></thead>
        <tbody>
        <?php foreach ($users as $u): $uidRow = (int)$u['id']; $roleOf = user_role($uidRow); ?>
          <?php if ($canEdit && $editId === $uidRow): ?>
          <tr class="admin-edit"><td colspan="6">
            <form method="post" class="auth-form admin-form" autocomplete="off">
              <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
              <input type="hidden" name="do" value="save"><input type="hidden" name="id" value="<?= $uidRow ?>">
              <label>Name<input name="name" value="<?= h($_POST['name'] ?? $u['name']) ?>" required maxlength="80"></label>
              <label>Email<input name="email" type="email" value="<?= h($_POST['email'] ?? $u['email']) ?>" required></label>
              <?php if (!is_owner($uidRow)): ?>
              <label>Role<select name="role">
                <option value="user"<?= $roleOf === 'user' ? ' selected' : '' ?>>User</option>
                <option value="subadmin"<?= $roleOf === 'subadmin' ? ' selected' : '' ?>>Sub admin (can only look at this page)</option>
                <option value="admin"<?= $roleOf === 'admin' ? ' selected' : '' ?>>Admin (can change everything here)</option>
              </select></label>
              <?php else: ?><p class="hint2">This is the owner account. Its role can't be changed.</p><?php endif; ?>
              <label class="check"><input type="checkbox" name="verified" value="1"<?= (int)$u['verified_badge'] === 1 ? ' checked' : '' ?>> Verified account (blue tick)</label>
              <label>New password (leave empty to keep theirs)<input name="password" type="password" minlength="8" autocomplete="new-password"></label>
              <div class="xrow"><button class="btn primary">Save</button><a class="btn ghost" href="admin.php">Cancel</a></div>
            </form>
          </td></tr>
          <?php else: ?>
          <tr>
            <td><?= h($u['name']) ?><?= vbadge((int)$u['verified_badge'] === 1) ?></td>
            <td class="email"><?= h($u['email']) ?></td>
            <td><span class="tag2<?= $roleOf === 'user' ? ' priv' : '' ?>"><?= is_owner($uidRow) ? 'Owner' : ['admin' => 'Admin', 'subadmin' => 'Sub admin', 'user' => 'User'][$roleOf] ?></span></td>
            <td><?= h(when($u['created_at'])) ?></td>
            <td><?= h(when($u['last_login'])) ?></td>
            <?php if ($canEdit): ?>
            <td class="admin-acts">
              <a class="btn sm" href="admin.php?edit=<?= $uidRow ?>">Edit</a>
              <form method="post" class="inline">
                <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="do" value="verify"><input type="hidden" name="id" value="<?= $uidRow ?>"><input type="hidden" name="on" value="<?= (int)$u['verified_badge'] === 1 ? 0 : 1 ?>">
                <button class="btn sm"><?= (int)$u['verified_badge'] === 1 ? 'Remove tick' : 'Verify' ?></button>
              </form>
              <?php if ($uidRow !== $uid && !is_admin($uidRow)): ?>
              <form method="post" class="inline" onsubmit="return confirm('Delete <?= h(addslashes($u['name'])) ?> and everything in their account for good?')">
                <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="do" value="delete"><input type="hidden" name="id" value="<?= $uidRow ?>">
                <button class="btn sm danger">Delete</button>
              </form>
              <?php endif; ?>
            </td>
            <?php endif; ?>
          </tr>
          <?php endif; ?>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
<?php app_bottom();
