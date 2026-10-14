<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/layout.php';

$uid = require_login();
$user = q('SELECT name FROM users WHERE id = ?', [$uid])->fetch();
if (!$user) {            // account was deleted
    session_destroy();
    header('Location: login.php');
    exit;
}
$prof = ensure_profile($uid);
$design = profile_design($prof);
$unread = unread_count($uid);
?>
<!DOCTYPE html>
<html lang="en"<?= design_attrs($design, 'accent') ?>>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= h(csrf_token()) ?>">
  <title>Splanner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="<?= FONT_LINK ?>" rel="stylesheet">
  <link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <script>try{var t=localStorage.getItem('sara-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script src="assets/lang.js?v=<?= filemtime(__DIR__ . '/assets/lang.js') ?>"></script>
</head>
<body>
<div class="app">
  <header class="top">
    <div class="brand"><?= logo_html() ?><span class="hello"><i class="avatar" aria-hidden="true"><?= h(mb_strtoupper(mb_substr($user['name'], 0, 1))) ?></i><span>Hi, <?= h($user['name']) ?></span></span></div>
    <div class="top-r">
      <span class="date-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><span class="chip-date" id="todayChip"></span></span>
      <a class="btn" href="people.php">People</a>
      <button class="btn bell" data-act="tab" data-tab="alerts" aria-label="Notifications"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg><span class="badge" id="bellBadge"<?= $unread ? '' : ' hidden' ?>><?= $unread ?></span></button>
      <?php if (is_admin($uid)): ?><a class="btn" href="admin.php">Users</a><?php endif; ?>
      <button class="btn" data-lang-btn>Shqip</button>
      <button class="btn" id="themeBtn" data-act="theme" aria-label="Switch theme"></button>
      <form method="post" action="logout.php" class="inline">
        <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
        <button class="btn ghost logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>Log out</button>
      </form>
    </div>
  </header>
  <div class="binder">
    <div class="coil" aria-hidden="true" id="coil"></div>
    <main class="page" id="view" aria-live="polite"<?= design_attrs($design, 'page') ?>><p class="empty">Loading your planner…</p></main>
    <nav class="tabs" role="tablist" aria-label="Planner sections">
      <button class="tab" role="tab" data-act="tab" data-tab="day">Day</button>
      <button class="tab" role="tab" data-act="tab" data-tab="week">Week</button>
      <button class="tab" role="tab" data-act="tab" data-tab="month">Month</button>
      <button class="tab" role="tab" data-act="tab" data-tab="year">Year</button>
      <div class="tab-gap"></div>
      <button class="tab" role="tab" data-act="tab" data-tab="study">Study</button>
      <button class="tab" role="tab" data-act="tab" data-tab="tasks">Tasks</button>
      <button class="tab" role="tab" data-act="tab" data-tab="money">Expenses</button>
      <div class="tab-gap"></div>
      <button class="tab" role="tab" data-act="tab" data-tab="blog">Blog</button>
      <button class="tab" role="tab" data-act="tab" data-tab="interests">Interests</button>
      <button class="tab" role="tab" data-act="tab" data-tab="profile">Profile</button>
      <button class="tab" role="tab" data-act="tab" data-tab="alerts">Alerts<?= $unread ? ' <span class="badge" id="tabBadge">' . $unread . '</span>' : '' ?></button>
    </nav>
  </div>
</div>
<div class="toast" id="toast" role="status" hidden></div>
<script src="assets/import.js?v=<?= filemtime(__DIR__ . '/assets/import.js') ?>"></script>
<script src="assets/social.js?v=<?= filemtime(__DIR__ . '/assets/social.js') ?>"></script>
<script src="assets/app.js?v=<?= filemtime(__DIR__ . '/assets/app.js') ?>"></script>
</body>
</html>
