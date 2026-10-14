<?php
// Shared header/footer for the login and sign-up pages.

/** The Splanner logo (script wordmark). Pass a link to make it clickable. */
function logo_html(?string $href = null): string
{
    return $href
        ? '<a class="logo" href="' . h($href) . '">Splanner</a>'
        : '<span class="logo">Splanner</span>';
}

function auth_top(string $title, string $cardClass = '', bool $covers = false): void
{ ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= h($title) ?> · Splanner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <?php if ($covers): ?>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Great+Vibes&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/covers.css?v=<?= filemtime(__DIR__ . '/assets/covers.css') ?>">
  <?php endif; ?>
  <script>try{var t=localStorage.getItem('sara-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script src="assets/lang.js?v=<?= filemtime(__DIR__ . '/assets/lang.js') ?>"></script>
</head>
<body>
<main class="auth">
  <div class="auth-card<?= $cardClass ? ' ' . h($cardClass) : '' ?>">
    <div class="auth-lang"><button class="btn ghost" data-theme-btn aria-label="Switch theme"></button> <button class="linkbtn langsw" data-lang-btn>Shqip</button></div>
    <?= logo_html('welcome.php') ?>
<?php }

function auth_bottom(): void
{ ?>
  </div>
</main>
<script src="assets/theme.js?v=<?= filemtime(__DIR__ . '/assets/theme.js') ?>"></script>
</body>
</html>
<?php }
