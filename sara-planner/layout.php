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

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Pacifico&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Caveat:wght@500;700&family=Lora:wght@400;600&display=swap';

/** data-… attributes that apply a notebook design. $part: 'accent' (colour, goes on <html>), 'page' (paper + handwriting, goes on the notebook page), 'all'. Defaults add nothing. */
function design_attrs(array $d, string $part = 'all'): string
{
    $o = '';
    if ($part === 'accent') return ($d['accent'] ?? 'violet') !== 'violet' ? ' data-accent="' . h($d['accent']) . '"' : '';
    if ($part === 'all' && ($d['accent'] ?? 'violet') !== 'violet') $o .= ' data-accent="' . h($d['accent']) . '"';
    if (($d['paper'] ?? 'lined') !== 'lined') $o .= ' data-paper="' . h($d['paper']) . '"';
    if (($d['paper_color'] ?? 'white') !== 'white') $o .= ' data-pcolor="' . h($d['paper_color']) . '"';
    if (($d['font'] ?? 'modern') !== 'modern') $o .= ' data-font="' . h($d['font']) . '"';
    return $o;
}

/** The cover banner with its stickers. $coverUrl is the custom cover picture, if any. */
function banner_html(array $d, string $coverUrl = '', string $extraClass = ''): string
{
    $style = $coverUrl !== '' ? ' style="--img:url(\'' . h($coverUrl) . '\')"' : '';
    $o = '<div class="nb-banner' . ($coverUrl !== '' ? ' has-img' : '') . ($extraClass ? ' ' . h($extraClass) : '') . '" data-cover="' . h($d['cover'] ?? 'dusk') . '"' . $style . '>';
    foreach ((array)($d['stickers'] ?? []) as $s) {
        $css = '--x:' . (float)$s['x'] . '%;--y:' . (float)$s['y'] . '%;--s:' . (float)$s['s'] . ';--r:' . (int)$s['r'] . 'deg';
        if (str_starts_with((string)$s['k'], 'up:')) {
            $url = upload_url((int)substr($s['k'], 3));
            if ($url !== '') $o .= '<img class="stk" alt="" src="' . h($url) . '" style="' . $css . '">';
        } else {
            $o .= '<span class="stk" aria-hidden="true" style="' . $css . '">' . h($s['k']) . '</span>';
        }
    }
    return $o . '</div>';
}

/** Top of the public notebook pages (u.php, people.php): a slim bar, works logged in or not. */
function pub_top(string $title, array $design = [], ?int $viewer = null): void
{ ?>
<!DOCTYPE html>
<html lang="en"<?= design_attrs($design, 'accent') ?>>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= h(csrf_token()) ?>">
  <title><?= h($title) ?> · Splanner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="<?= FONT_LINK ?>" rel="stylesheet">
  <link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <script>try{var t=localStorage.getItem('sara-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script src="assets/lang.js?v=<?= filemtime(__DIR__ . '/assets/lang.js') ?>"></script>
</head>
<body>
<div class="pub">
  <header class="pub-top">
    <?= logo_html($viewer ? 'index.php' : 'welcome.php') ?>
    <nav>
      <a class="btn" href="explore.php">Explore</a>
      <?php if ($viewer): ?>
        <a class="btn" href="people.php">People</a>
        <a class="btn" href="index.php">My planner</a>
      <?php else: ?>
        <a class="btn" href="login.php">Log in</a>
        <a class="btn primary" href="register.php">Create free account</a>
      <?php endif; ?>
      <button class="btn" data-lang-btn>Shqip</button>
      <button class="btn" data-theme-btn aria-label="Switch theme"></button>
    </nav>
  </header>
<?php }

function pub_bottom(): void
{ ?>
</div>
<script src="assets/theme.js?v=<?= filemtime(__DIR__ . '/assets/theme.js') ?>"></script>
</body>
</html>
<?php }
