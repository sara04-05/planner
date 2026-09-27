<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';

$uid = require_login();
$user = q('SELECT name FROM users WHERE id = ?', [$uid])->fetch();
if (!$user) {            // account was deleted
    session_destroy();
    header('Location: login.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= h(csrf_token()) ?>">
  <title>Splanner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/style.css?v=8">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <script>try{var t=localStorage.getItem('sara-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
</head>
<body>
<div class="app">
  <header class="top">
    <div class="brand"><?= logo_html() ?><span>Hi, <?= h($user['name']) ?></span></div>
    <div class="top-r">
      <span class="chip-date" id="todayChip"></span>
      <?php if (is_admin($uid)): ?><a class="btn" href="admin.php">Users</a><?php endif; ?>
      <button class="btn" id="themeBtn" data-act="theme" aria-label="Switch theme"></button>
      <form method="post" action="logout.php" class="inline">
        <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
        <button class="btn ghost">Log out</button>
      </form>
    </div>
  </header>
  <div class="binder">
    <div class="coil" aria-hidden="true" id="coil"></div>
    <main class="page" id="view" aria-live="polite"><p class="empty">Loading your planner…</p></main>
    <nav class="tabs" role="tablist" aria-label="Planner sections">
      <button class="tab" role="tab" data-act="tab" data-tab="day">Day</button>
      <button class="tab" role="tab" data-act="tab" data-tab="week">Week</button>
      <button class="tab" role="tab" data-act="tab" data-tab="month">Month</button>
      <button class="tab" role="tab" data-act="tab" data-tab="year">Year</button>
      <div class="tab-gap"></div>
      <button class="tab" role="tab" data-act="tab" data-tab="study">Study</button>
      <button class="tab" role="tab" data-act="tab" data-tab="tasks">Tasks</button>
      <button class="tab" role="tab" data-act="tab" data-tab="money">Expenses</button>
    </nav>
  </div>
</div>
<div class="toast" id="toast" role="status" hidden></div>
<script src="assets/app.js?v=7"></script>
</body>
</html>
