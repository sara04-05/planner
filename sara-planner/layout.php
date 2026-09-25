<?php
// Shared header/footer for the login and sign-up pages.

function auth_top(string $title): void
{ ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= h($title) ?> · Sara's Planner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/style.css">
  <script>try{var t=localStorage.getItem('sara-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
</head>
<body>
<main class="auth">
  <div class="auth-card">
    <p class="eyebrow">Sara's Planner</p>
<?php }

function auth_bottom(): void
{ ?>
  </div>
</main>
</body>
</html>
<?php }
