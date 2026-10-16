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
    <div class="auth-lang"><button class="btn ghost" data-theme-btn aria-label="Switch theme" title="Switch theme"></button> <button class="linkbtn langsw" data-lang-btn>Shqip</button></div>
    <?= logo_html('welcome.php') ?>
<?php }

function auth_bottom(): void
{ ?>
  </div>
</main>
<script src="assets/theme.js?v=<?= filemtime(__DIR__ . '/assets/theme.js') ?>"></script>
<script src="assets/ruled.js?v=<?= filemtime(__DIR__ . '/assets/ruled.js') ?>" defer></script>
<?php if (current_user_id()): ?><script src="assets/bell.js?v=<?= filemtime(__DIR__ . '/assets/bell.js') ?>"></script><?php endif; ?>
</body>
</html>
<?php }

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Pacifico&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Caveat:wght@500;700&family=Lora:wght@400;600&display=swap';

/** Is this #rrggbb colour light? (0 = black … 1 = white) */
function hex_lum(string $hex): float
{
    $c = array_map(fn($v) => (hexdec($v) / 255) <= 0.03928 ? (hexdec($v) / 255) / 12.92 : ((hexdec($v) / 255 + 0.055) / 1.055) ** 2.4, str_split(ltrim($hex, '#'), 2));
    return 0.2126 * $c[0] + 0.7152 * $c[1] + 0.0722 * $c[2];
}

/** data-… attributes that apply a notebook design. $part: 'accent' (colour, goes on <html> or a wrapper), 'page' (paper + handwriting, goes on the notebook page), 'all'. Defaults add nothing. */
function design_attrs(array $d, string $part = 'all'): string
{
    $o = '';
    $acc = ($d['accent'] ?? 'violet') !== 'violet' ? ' data-accent="' . h($d['accent']) . '"' : '';
    if ($part === 'accent') return $acc;
    if ($part === 'all') $o .= $acc;
    if (($d['label'] ?? 'box') === 'none') $o .= ' data-label="none"';
    if (($d['paper'] ?? 'lined') !== 'lined') $o .= ' data-paper="' . h($d['paper']) . '"';
    if (($d['paper_color'] ?? 'white') !== 'white') $o .= ' data-pcolor="' . h($d['paper_color']) . '"';
    if (($d['font'] ?? 'modern') !== 'modern') $o .= ' data-font="' . h($d['font']) . '"';
    if (($d['paper_color'] ?? '') === 'custom' && !empty($d['paper_hex']) && hex_lum($d['paper_hex']) < 0.4) $o .= ' data-ptone="dark"';
    return $o;
}

/** style="…" with the colours a user picked themselves (accent, paper, cover). Empty when the design only uses ready-made colours. */
function design_style(array $d): string
{
    $v = '';
    if (($d['accent'] ?? '') === 'custom' && !empty($d['accent_hex'])) $v .= '--c-accent:' . h($d['accent_hex']) . ';--c-on:' . (hex_lum($d['accent_hex']) > 0.55 ? '#17121F' : '#FFFFFF') . ';';
    if (($d['paper_color'] ?? '') === 'custom' && !empty($d['paper_hex'])) $v .= '--c-paper:' . h($d['paper_hex']) . ';';
    if (!empty($d['label_hex'])) $v .= '--c-label:' . h($d['label_hex']) . ';--c-label-ink:' . (hex_lum($d['label_hex']) > 0.5 ? '#2B2118' : '#FFFFFF') . ';';
    return $v !== '' ? ' style="' . $v . '"' : '';
}

/** CSS background of a notebook cover: a picture, the colours the user picked, or a ready-made gradient. */
function cover_css(array $d, string $imgUrl = ''): string
{
    if ($imgUrl !== '') return "background:url('" . h($imgUrl) . "') center/cover";
    if (($d['cover'] ?? '') === 'custom' && !empty($d['cover_c1']) && !empty($d['cover_c2'])) return 'background:linear-gradient(135deg,' . h($d['cover_c1']) . ',' . h($d['cover_c2']) . ')';
    if (in_array($d['cover'] ?? '', ART_COVERS, true)) return 'background:var(--cov-' . $d['cover'] . ')';
    $g = COVER_GRADIENTS[$d['cover'] ?? 'dusk'] ?? COVER_GRADIENTS['dusk'];
    return 'background:linear-gradient(135deg,' . $g[0] . ',' . $g[1] . ')';
}

/** The stickers placed on one page of a notebook ($page = 'cover' or a section name). Pass $edit = true in the owner's editor. */
function stickers_html(array $d, string $page): string
{
    $o = '';
    foreach ((array)($d['stickers'] ?? []) as $i => $s) {
        if (($s['p'] ?? 'cover') !== $page) continue;
        $css = '--x:' . (float)$s['x'] . '%;--y:' . (float)$s['y'] . '%;--s:' . (float)$s['s'] . ';--r:' . (int)$s['r'] . 'deg';
        if (str_starts_with((string)$s['k'], 'up:')) {
            $url = upload_url((int)substr($s['k'], 3));
            if ($url !== '') $o .= '<img class="stk" alt="" src="' . h($url) . '" style="' . $css . '">';
        } else {
            $o .= '<span class="stk" aria-hidden="true" style="' . $css . '">' . h($s['k']) . '</span>';
        }
    }
    return '<div class="stk-layer" aria-hidden="true">' . $o . '</div>';
}

/** A card for someone's shared notebooks: the cover of the first one, their name, and the titles of their notebooks. */
function person_card(array $r, array $nbs): string
{
    $first = $nbs[0];
    $d = $first['design'];
    $titles = implode(' · ', array_map(fn($n) => h($n['title']), array_slice($nbs, 0, 4)));
    return '<a class="person" href="u.php?u=' . h($r['slug']) . '"' . design_attrs($d, 'accent') . design_style($d) . '>'
        . '<div class="nb-banner" style="' . cover_css($d, $first['cover_url']) . '"></div>'
        . '<div class="pb"><div class="av" aria-hidden="true">' . h(mb_strtoupper(mb_substr($r['name'], 0, 1))) . '</div>'
        . '<h3 translate="no">' . h($r['name']) . '</h3>'
        . '<p translate="no">' . ($r['bio'] !== '' ? h($r['bio']) : '@' . h($r['slug'])) . '</p>'
        . '<p class="nbtitles" translate="no">' . $titles . '</p></div></a>';
}

// ---------- the notebook shell: every page of the site is a page of the same notebook ----------

/** The side tabs of the planner. $planner = true on index.php (buttons that switch tab), false elsewhere (links into the planner). */
function planner_tabs_html(string $active = '', bool $planner = false): string
{
    $tabs = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'], null, ['study', 'Study'], ['tasks', 'Tasks'], ['money', 'Expenses']];
    $o = '';
    foreach ($tabs as $t) {
        if ($t === null) { $o .= '<div class="tab-gap"></div>'; continue; }
        [$k, $label] = $t;
        $o .= $planner
            ? '<button class="tab" role="tab" data-act="tab" data-tab="' . $k . '">' . $label . '</button>'
            : '<a class="tab" role="tab" href="index.php?tab=' . $k . '" data-tab="' . $k . '"' . ($active === $k ? ' aria-selected="true"' : '') . '>' . $label . '</a>';
    }
    return $o;
}

/** The navigation bar at the top of every page (the same on the planner, People, Messages, profiles…). */
function app_nav(?int $uid, string $active = '', bool $planner = false): void
{
    $ic = fn(string $d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $d . '</svg>';
    $me = $uid ? person($uid) : null;
    ?>
  <header class="top">
    <div class="brand"><?= logo_html($uid ? 'index.php' : 'welcome.php') ?>
      <?php if ($me): ?>
        <?php $hello = ($me['avatar_v'] ? '<img class="avatar" alt="" src="avatar.php?id=' . $uid . '&amp;v=' . $me['avatar_v'] . '">' : '<i class="avatar" aria-hidden="true">' . h(mb_strtoupper(mb_substr($me['name'], 0, 1))) . '</i>') . '<span>Hi, ' . h($me['name']) . '</span>'; ?>
        <?php if ($planner): ?><button class="hello" data-act="tab" data-tab="profile" title="My profile"><?= $hello ?></button>
        <?php else: ?><a class="hello" href="index.php?tab=profile" title="My profile"><?= $hello ?></a><?php endif; ?>
      <?php endif; ?>
    </div>
    <div class="top-r">
    <?php if ($uid):
        $unread = unread_count($uid); $chatUnread = chat_unread($uid); $requests = friend_requests_count($uid); ?>
      <span class="date-pill"><?= $ic('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>') ?><span class="chip-date" id="todayChip"><?= h(date('l, j F')) ?></span></span>
      <a class="btn bell<?= $active === 'explore' ? ' on' : '' ?>" href="explore.php" aria-label="Explore" title="Explore"><?= $ic('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>') ?>Explore<?php if ($requests): ?><span class="badge"><?= $requests ?></span><?php endif; ?></a>
      <a class="btn bell<?= $active === 'messages' ? ' on' : '' ?>" href="messages.php" id="msgBtn" aria-label="Messages" title="Messages"><?= $ic('<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/>') ?>Messages<?php if ($chatUnread): ?><span class="badge"><?= $chatUnread ?></span><?php endif; ?></a>
      <div class="bellwrap">
        <button class="btn bell" id="bellBtn" title="Notifications" aria-label="Notifications" aria-haspopup="true" aria-expanded="false"><?= $ic('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>') ?><span class="badge" id="bellBadge"<?= $unread ? '' : ' hidden' ?>><?= $unread ?></span></button>
        <div class="bellpop" id="bellPop" role="dialog" aria-label="Notifications" hidden></div>
      </div>
      <?php if (can_view_users($uid)): ?><a class="btn<?= $active === 'admin' ? ' on' : '' ?>" href="admin.php" title="Users" aria-label="Users"><?= $ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>') ?>Users</a><?php endif; ?>
      <button class="btn" data-lang-btn aria-label="Language"><?= $ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>') ?><span class="lbl">Shqip</span></button>
      <button class="btn"<?= $planner ? ' id="themeBtn" data-act="theme"' : ' data-theme-btn' ?> aria-label="Switch theme" title="Switch theme"></button>
      <form method="post" action="logout.php" class="inline">
        <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
        <button class="btn ghost logout" aria-label="Log out" title="Log out"><?= $ic('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>') ?>Log out</button>
      </form>
    <?php else: ?>
      <a class="btn<?= $active === 'explore' ? ' on' : '' ?>" href="explore.php" title="Explore" aria-label="Explore"><?= $ic('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>') ?>Explore</a>
      <a class="btn" href="login.php" title="Log in" aria-label="Log in"><?= $ic('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>') ?>Log in</a>
      <a class="btn primary" href="register.php" title="Create free account" aria-label="Create free account"><?= $ic('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>') ?>Create free account</a>
      <button class="btn" data-lang-btn aria-label="Language"><?= $ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>') ?><span class="lbl">Shqip</span></button>
      <button class="btn"<?= $planner ? ' id="themeBtn" data-act="theme"' : ' data-theme-btn' ?> aria-label="Switch theme" title="Switch theme"></button>
    <?php endif; ?>
    </div>
  </header>
<?php }

/**
 * Start a page of the notebook: head, navigation bar, the binder with its coil and the page's heading.
 * $o: active (nav button to highlight), tab (planner tab to highlight), eyebrow, h1, actions (html), covers (load notebook-cover drawings),
 *     design (a notebook design: its colours, paper and font are used for this page), tabs (html of own side tabs, e.g. a notebook's pages), notabs.
 */
function app_top(string $title, array $o = []): void
{
    global $APP_SHELL;
    $uid = current_user_id();
    if ($uid && !is_verified($uid)) $uid = null;
    $d = $o['design'] ?? [];
    $APP_SHELL = ['tabs' => $o['tabs'] ?? ($uid && empty($o['notabs']) ? planner_tabs_html($o['tab'] ?? '', false) : ''), 'inside' => ''];
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= h(csrf_token()) ?>">
  <title><?= h($title) ?> · Splanner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="<?= FONT_LINK ?>" rel="stylesheet">
  <?php if (!empty($o['covers'])): ?><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Great+Vibes&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/covers.css?v=<?= filemtime(__DIR__ . '/assets/covers.css') ?>"><?php endif; ?>
  <link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <script>try{var t=localStorage.getItem('sara-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<script src="assets/lang.js?v=<?= filemtime(__DIR__ . '/assets/lang.js') ?>"></script>
</head>
<body>
<div class="app"<?= design_attrs($d, 'accent') . design_style($d) ?>>
<?php app_nav($uid, $o['active'] ?? ''); ?>
  <div class="binder<?= $APP_SHELL['tabs'] === '' ? ' notabs' : '' ?>"<?= ($d['binding'] ?? 'coil') !== 'coil' ? ' data-binding="' . h($d['binding']) . '"' : '' ?>>
    <div class="coil" aria-hidden="true"><?= str_repeat('<span></span>', 90) ?></div>
    <main class="page"<?= design_attrs($d, 'page') ?>>
      <?php if (!empty($o['h1'])): ?>
      <div class="vh"><div><?php if (!empty($o['eyebrow'])): ?><p class="eyebrow"><?= h($o['eyebrow']) ?></p><?php endif; ?><h1><?= h($o['h1']) ?></h1></div><div class="nav"><?= $o['actions'] ?? '' ?></div></div>
      <?php endif; ?>
<?php }

/** Extra html that goes inside the page, after everything else (a notebook page's stickers). Call before app_bottom(). */
function app_inside(string $html): void
{
    global $APP_SHELL;
    $APP_SHELL['inside'] .= $html;
}

function app_bottom(): void
{
    global $APP_SHELL; ?>
      <?= $APP_SHELL['inside'] ?>
    </main>
    <?php if ($APP_SHELL['tabs'] !== ''): ?><nav class="tabs" role="tablist" aria-label="Sections"><?= $APP_SHELL['tabs'] ?></nav><?php endif; ?>
  </div>
</div>
<script src="assets/theme.js?v=<?= filemtime(__DIR__ . '/assets/theme.js') ?>"></script>
<script src="assets/ruled.js?v=<?= filemtime(__DIR__ . '/assets/ruled.js') ?>" defer></script>
<?php if (current_user_id()): ?><script src="assets/bell.js?v=<?= filemtime(__DIR__ . '/assets/bell.js') ?>"></script><?php endif; ?>
</body>
</html>
<?php }
