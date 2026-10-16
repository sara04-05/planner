<?php
// Look inside: the real planner with sample data, for visitors without an account. View only: assets/app.js never calls api.php here.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';

if (current_user_id()) {   // already have an account: go to your own planner
    header('Location: index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Look inside · Splanner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="<?= FONT_LINK ?>" rel="stylesheet">
  <link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
  <link rel="stylesheet" href="assets/covers.css?v=<?= filemtime(__DIR__ . '/assets/covers.css') ?>">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <script>try{var t=localStorage.getItem('sara-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script src="assets/lang.js?v=<?= filemtime(__DIR__ . '/assets/lang.js') ?>"></script>
</head>
<body class="tour">
<div class="app">
<?php app_nav(null, '', true); ?>
  <div class="pub-note tour-note" role="status"><b>You are looking around.</b> This is the real planner with sample data, view only. Nothing can be added or saved. <a href="register.php">Create a free account</a> or <a href="login.php">log in</a> to use it.</div>
  <div class="binder">
    <div class="coil" aria-hidden="true" id="coil"></div>
    <main class="page" id="view" aria-live="polite"><p class="empty">Loading your planner…</p></main>
    <nav class="tabs" role="tablist" aria-label="Planner sections"><?= planner_tabs_html('', true) ?></nav>
  </div>
</div>
<div class="toast" id="toast" role="status" hidden></div>
<script src="assets/tour.js?v=<?= filemtime(__DIR__ . '/assets/tour.js') ?>"></script>
<script src="assets/ruled.js?v=<?= filemtime(__DIR__ . '/assets/ruled.js') ?>" defer></script>
<script src="assets/app.js?v=<?= filemtime(__DIR__ . '/assets/app.js') ?>"></script>
</body>
</html>
