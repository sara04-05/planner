<?php
// Every account on the site: name, email, when they signed up and last logged in.
// Only the emails listed in ADMIN_EMAILS (config.php) can open this page.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';

$uid = require_login();
if (!is_admin($uid)) {
    http_response_code(403);
    auth_top('Not allowed'); ?>
    <h1>Not allowed</h1>
    <p class="auth-sub">This page is only for the site owner.</p>
    <p class="auth-alt"><a href="index.php">Back to your planner</a></p>
<?php
    auth_bottom();
    exit;
}

try {
    $users = q('SELECT name, email, created_at, last_login FROM users ORDER BY created_at DESC, id DESC')->fetchAll();
} catch (PDOException $e) {   // last_login column couldn't be added on this host
    $users = q('SELECT name, email, created_at, NULL AS last_login FROM users ORDER BY created_at DESC, id DESC')->fetchAll();
}

function when(?string $ts): string
{
    return $ts ? date('j M Y, H:i', strtotime($ts)) : '—';
}

auth_top('Users', 'wide'); ?>
    <div class="admin-top">
      <h1>Users</h1>
      <a class="btn" href="index.php">Back to planner</a>
    </div>
    <p class="auth-sub"><span class="admin-count"><?= count($users) ?></span> <?= count($users) === 1 ? 'account' : 'accounts' ?> in this database.</p>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>Name</th><th>Email</th><th>Signed up</th><th>Last login</th></tr></thead>
        <tbody>
        <?php foreach ($users as $u): ?>
          <tr>
            <td><?= h($u['name']) ?></td>
            <td class="email"><?= h($u['email']) ?></td>
            <td><?= h(when($u['created_at'])) ?></td>
            <td><?= h(when($u['last_login'])) ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    </div>
<?php auth_bottom();
