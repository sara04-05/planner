<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
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
<html lang="en"<?= design_attrs($design, 'accent') . design_style($design) ?>>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= h(csrf_token()) ?>">
  <title>Splanner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="<?= FONT_LINK ?>" rel="stylesheet">
  <link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
  <link rel="stylesheet" href="assets/covers.css?v=<?= filemtime(__DIR__ . '/assets/covers.css') ?>">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <script>try{var t=localStorage.getItem('sara-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script src="assets/lang.js?v=<?= filemtime(__DIR__ . '/assets/lang.js') ?>"></script>
<script src="assets/icons.js?v=<?= filemtime(__DIR__ . '/assets/icons.js') ?>"></script>
</head>
<body>
<div class="app">
<?php app_nav($uid, '', true); ?>
  <div class="binder">
    <div class="coil" aria-hidden="true" id="coil"></div>
    <main class="page" id="view" aria-live="polite"<?= design_attrs($design, 'page') ?>><p class="empty">Loading your planner…</p></main>
    <nav class="tabs" role="tablist" aria-label="Planner sections"><?= planner_tabs_html('', true) ?></nav>
  </div>
</div>
<div class="toast" id="toast" role="status" hidden></div>
<script src="assets/import.js?v=<?= filemtime(__DIR__ . '/assets/import.js') ?>"></script>
<script src="assets/bell.js?v=<?= filemtime(__DIR__ . '/assets/bell.js') ?>"></script>
<script src="assets/social.js?v=<?= filemtime(__DIR__ . '/assets/social.js') ?>"></script>
<script src="assets/ruled.js?v=<?= filemtime(__DIR__ . '/assets/ruled.js') ?>" defer></script>
<script src="assets/app.js?v=<?= filemtime(__DIR__ . '/assets/app.js') ?>"></script>
</body>
</html>
