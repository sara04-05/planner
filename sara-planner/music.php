<?php
// Music: a Spotify player on its own page of the notebook.
//   Anyone can paste a Spotify link (playlist, album, song, podcast) and it plays in Spotify's own player on the page.
//   With SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in config.php people can also connect their own Spotify account:
//   music.php?connect=1          sends you to Spotify to allow access
//   music.php?code=...           Spotify sends you back here (this is the Redirect URI in the Spotify dashboard)
//   music.php?token=1            a fresh access token for the player in the browser (JSON)
//   music.php?mini=1             the small pop-out window that keeps playing while you use the planner
//   POST do=link / do=disconnect (with the CSRF token)
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/spotify.php';

$uid = require_login();
$mini = isset($_GET['mini']);

function back(string $result): never
{
    header('Location: music.php?sp=' . urlencode($result));
    exit;
}

function user_link(int $uid): string
{
    try {
        return (string)(q('SELECT link FROM user_music WHERE user_id = ?', [$uid])->fetch()['link'] ?? '');
    } catch (PDOException $e) {
        return '';
    }
}

function saved_list(int $uid): array
{
    try {
        return q('SELECT id, link, title, image FROM music_saved WHERE user_id = ? ORDER BY id', [$uid])->fetchAll();
    } catch (PDOException $e) {
        return [];
    }
}

/** The name and cover picture of a Spotify link, from Spotify's public oEmbed (no login needed). Empty when Spotify can't be reached. */
function spotify_info(string $link): array
{
    try {
        $ch = curl_init('https://open.spotify.com/oembed?url=' . rawurlencode($link));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => true]);
        $r = json_decode((string)curl_exec($ch), true) ?: [];
        return ['title' => mb_substr((string)($r['title'] ?? ''), 0, 190), 'image' => str_starts_with((string)($r['thumbnail_url'] ?? ''), 'https://') ? mb_substr($r['thumbnail_url'], 0, 255) : ''];
    } catch (Throwable $e) {
        return ['title' => '', 'image' => ''];
    }
}

/** Cover pictures for the suggested playlists. Spotify is asked once and the answer is kept in a small file for a month (an hour if Spotify couldn't be reached), so the page doesn't wait on Spotify each time. */
function preset_covers(): array
{
    $file = sys_get_temp_dir() . '/splanner-preset-covers.json';
    $have = json_decode((string)@file_get_contents($file), true);
    $have = is_array($have) ? $have : [];
    $changed = false;
    foreach (MUSIC_PRESETS as [, $id]) {
        $e = $have[$id] ?? null;
        $age = time() - (int)($e['at'] ?? 0);
        if ($e && $age < (($e['image'] ?? '') !== '' ? 30 * 86400 : 3600)) continue;
        $have[$id] = ['image' => spotify_info('https://open.spotify.com/playlist/' . $id)['image'], 'at' => time()];
        $changed = true;
    }
    if ($changed) @file_put_contents($file, json_encode($have), LOCK_EX);
    return array_map(fn($e) => (string)($e['image'] ?? ''), $have);
}

const SAVED_NAMES = ['playlist' => 'My playlist', 'album' => 'Album', 'track' => 'Song', 'artist' => 'Artist', 'episode' => 'Podcast episode', 'show' => 'Podcast'];

// ---- the browser player asks for a token (it lasts an hour, so this is asked rarely) ----
if (isset($_GET['token'])) {
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    $acc = spotify_configured() ? spotify_account($uid) : null;
    if (!$acc) { http_response_code(404); echo json_encode(['error' => 'Spotify is not connected.']); exit; }
    try {
        $token = spotify_token($uid, $acc);
        echo json_encode(['token' => $token, 'expires_in' => max(60, (int)$acc['expires_at'] - time())]);
    } catch (RuntimeException $e) {
        http_response_code(502);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// ---- save a link / disconnect ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $ajax = ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'fetch';
    if (!check_csrf($_POST['csrf'] ?? null)) {
        if ($ajax) { http_response_code(403); exit; }
        back('error');
    }
    $do = (string)($_POST['do'] ?? '');
    if ($do === 'link') {
        $link = trim((string)($_POST['link'] ?? ''));
        if (!spotify_parse_link($link)) {
            if ($ajax) { http_response_code(400); exit; }
            back('bad-link');
        }
        q('DELETE FROM user_music WHERE user_id = ?', [$uid]);
        q('INSERT INTO user_music (user_id, link) VALUES (?, ?)', [$uid, mb_substr($link, 0, 255)]);
        if ($ajax) { http_response_code(204); exit; }
        back('saved');
    }
    if ($do === 'save') {   // add a playlist to "My playlists"
        $p = spotify_parse_link((string)($_POST['link'] ?? ''));
        if (!$p) {
            if ($ajax) { http_response_code(400); exit; }
            back('bad-link');
        }
        $link = 'https://open.spotify.com/' . $p[0] . '/' . $p[1];
        $list = saved_list($uid);
        $have = array_values(array_filter($list, fn($r) => $r['link'] === $link));
        if ($have) {
            $row = $have[0];
        } elseif (count($list) >= 40) {
            if ($ajax) { http_response_code(409); exit; }
            back('full');
        } else {
            $info = spotify_info($link);
            $title = $info['title'] !== '' ? $info['title'] : SAVED_NAMES[$p[0]];
            q('INSERT INTO music_saved (user_id, link, title, image) VALUES (?, ?, ?, ?)', [$uid, $link, $title, $info['image']]);
            $row = ['id' => (int)db()->lastInsertId(), 'link' => $link, 'title' => $title, 'image' => $info['image']];
        }
        if ($ajax) { header('Content-Type: application/json'); echo json_encode($row); exit; }
        back('added');
    }
    if ($do === 'unsave') {
        q('DELETE FROM music_saved WHERE id = ? AND user_id = ?', [(int)($_POST['id'] ?? 0), $uid]);
        if ($ajax) { http_response_code(204); exit; }
        back('removed');
    }
    if ($do === 'disconnect') {
        spotify_forget($uid);   // Spotify has no revoke call; people can also remove Splanner under "Manage apps" in their Spotify account
        back('disconnected');
    }
    back('error');
}

// ---- step 1: off to Spotify ----
if (isset($_GET['connect'])) {
    if (!spotify_configured()) back('not-set-up');
    $_SESSION['spotify_state'] = bin2hex(random_bytes(16));
    header('Location: https://accounts.spotify.com/authorize?' . http_build_query([
        'client_id'     => SPOTIFY_CLIENT_ID,
        'response_type' => 'code',
        'redirect_uri'  => spotify_redirect_uri(),
        'scope'         => SPOTIFY_SCOPE,
        'state'         => $_SESSION['spotify_state'],
    ]));
    exit;
}

// ---- step 2: back from Spotify ----
if (isset($_GET['code']) || (isset($_GET['error']) && isset($_GET['state']))) {
    $state = (string)($_GET['state'] ?? '');
    $expected = (string)($_SESSION['spotify_state'] ?? '');
    unset($_SESSION['spotify_state']);
    if (!spotify_configured() || $expected === '' || !hash_equals($expected, $state)) back('error');
    if (isset($_GET['error'])) back('cancelled');   // "Cancel" on Spotify's page

    try {
        [$st, $tok] = spotify_http('POST', 'https://accounts.spotify.com/api/token', [
            'grant_type' => 'authorization_code', 'code' => (string)$_GET['code'], 'redirect_uri' => spotify_redirect_uri(),
        ]);
        if ($st !== 200 || empty($tok['access_token']) || empty($tok['refresh_token'])) {
            error_log('Spotify token: ' . json_encode($tok));
            back('error');
        }
        // While the Spotify app is in development mode, only accounts added in the dashboard may use it: Spotify answers 403 here
        [$st, $me] = spotify_http('GET', 'https://api.spotify.com/v1/me', null, $tok['access_token']);
    } catch (RuntimeException $e) {
        error_log('Spotify: ' . $e->getMessage());
        back('error');
    }
    if ($st === 403) back('not-allowed');
    if ($st !== 200) back('error');

    spotify_forget($uid);
    q('INSERT INTO spotify_accounts (user_id, spotify_name, refresh_token, access_token, expires_at) VALUES (?, ?, ?, ?, ?)',
        [$uid, mb_substr((string)($me['display_name'] ?? $me['id'] ?? ''), 0, 190), $tok['refresh_token'], $tok['access_token'], time() + (int)($tok['expires_in'] ?? 3600)]);
    back('connected');
}

// ---- the page ----
$configured = spotify_configured();
$acc = $configured ? spotify_account($uid) : null;
$link = user_link($uid);
$parsed = spotify_parse_link($link) ?? ['playlist', MUSIC_PRESETS[0][1]];
$notes = [
    'connected'    => ['ok', 'Spotify is connected. Pick one of your playlists below.'],
    'disconnected' => ['ok', 'Spotify is disconnected. You can also remove Splanner under "Manage apps" in your Spotify account.'],
    'cancelled'    => ['', 'Spotify was not connected.'],
    'not-allowed'  => ['bad', "This Spotify account can't connect yet. Splanner's Spotify app is in test mode, so the site owner has to add your Spotify email in the Spotify dashboard first."],
    'not-set-up'   => ['bad', 'Connecting Spotify is not set up on this site yet.'],
    'bad-link'     => ['bad', "That doesn't look like a Spotify link. Copy it in Spotify with Share → Copy link."],
    'saved'        => ['ok', 'Saved. This plays next time you open Music.'],
    'added'        => ['ok', 'Added to My playlists.'],
    'removed'      => ['ok', 'Removed from My playlists.'],
    'full'         => ['bad', 'My playlists is full. Remove one to add another.'],
    'error'        => ['bad', "Couldn't connect Spotify. Please try again."],
];
$note = $notes[(string)($_GET['sp'] ?? '')] ?? null;
$saved = saved_list($uid);
$initialTitle = '';   // what the big player shows when the page opens, so the controls can name it
foreach ($saved as $r) if ($r['link'] === 'https://open.spotify.com/' . $parsed[0] . '/' . $parsed[1]) $initialTitle = $r['title'];
foreach (MUSIC_PRESETS as [$n, $pid]) if ($parsed[0] === 'playlist' && $parsed[1] === $pid) $initialTitle = $n;

ob_start(); ?>
<div class="music<?= $mini ? ' mini' : '' ?>" id="music" data-csrf="<?= h(csrf_token()) ?>" data-connected="<?= $acc ? '1' : '' ?>">
  <?php if ($note): ?><p class="music-note <?= $note[0] ?>"><?= h($note[1]) ?></p><?php endif; ?>

  <section class="panel music-top" id="musicTop">
  <?php if ($acc): ?>
  <div class="sp-player" id="spPlayer" hidden>
    <div class="sp-now">
      <img class="sp-art" id="spArt" alt="" hidden>
      <div class="sp-meta"><strong id="spTitle" translate="no">Nothing playing yet</strong><span id="spArtist" translate="no"></span></div>
    </div>
    <div class="sp-ctrl">
      <button class="btn" data-sp="prev" aria-label="Previous song"><?= ico('prev') ?></button>
      <button class="btn primary" data-sp="toggle" id="spToggle" aria-label="Play or pause"><?= ico('play') ?></button>
      <button class="btn" data-sp="next" aria-label="Next song"><?= ico('next') ?></button>
      <input type="range" id="spVol" min="0" max="100" value="60" aria-label="Volume">
    </div>
  </div>
  <?php endif; ?>
  <div class="music-embed">
    <iframe id="spEmbed" title="Spotify player" data-title="<?= h($initialTitle) ?>" src="https://open.spotify.com/embed/<?= h($parsed[0]) ?>/<?= h($parsed[1]) ?>?utm_source=generator" loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
    <?php if ($acc): ?><div class="sp-tracks" id="spTracks" hidden></div><?php endif; ?>
  </div>
  </section>

  <section class="panel">
    <div class="sec-h"><h2>My playlists</h2><?php if (!$mini): ?><button class="btn sm" id="spPop" type="button">Pop out player ↗</button><?php endif; ?></div>
    <div class="sp-list" id="spSaved"><?php foreach ($saved as $r): ?>
      <div class="sp-saved"><button class="sp-item" type="button" data-sp-link="<?= h($r['link']) ?>" translate="no"><?php if ($r['image']): ?><img alt="" src="<?= h($r['image']) ?>" loading="lazy"><?php else: ?><i aria-hidden="true"><?= ico('music') ?></i><?php endif; ?><span><b><?= h($r['title']) ?></b></span></button>
        <form method="post" action="music.php"><input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="do" value="unsave"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><button class="sp-x" aria-label="Remove">×</button></form></div>
    <?php endforeach; ?></div>
    <?php if (!$mini): ?>
    <form class="music-link" id="spSaveForm" method="post" action="music.php">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="do" value="save">
      <input type="url" name="link" id="spSaveLink" placeholder="Paste the link to one of your Spotify playlists" required aria-label="Link to your playlist">
      <button class="btn primary">Add</button>
    </form>
    <p class="music-tip">In Spotify, open your playlist, tap ⋯ → Share → Copy link to playlist, and paste it here. If a playlist doesn't play, make it public in Spotify (⋯ → Make public).</p>
    <h3 class="sp-h">Suggested playlists</h3>
    <div class="sp-list sp-presets">
      <?php $covers = preset_covers(); foreach (MUSIC_PRESETS as [$name, $id, $about]): ?>
      <button class="sp-item" type="button" data-sp-link="https://open.spotify.com/playlist/<?= h($id) ?>"><?php if (!empty($covers[$id])): ?><img alt="" src="<?= h($covers[$id]) ?>" loading="lazy"><?php else: ?><i aria-hidden="true"><?= ico('music') ?></i><?php endif; ?><span><b translate="no"><?= h($name) ?></b><small><?= h($about) ?></small></span></button>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
  </section>

  <?php if (!$mini): ?>
  <section class="panel">
    <div class="sec-h"><h2>Play any Spotify link</h2></div>
    <form class="music-link" id="spLinkForm" method="post" action="music.php">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <input type="hidden" name="do" value="link">
      <input type="url" name="link" id="spLink" placeholder="https://open.spotify.com/playlist/…" value="<?= h($link) ?>" required aria-label="Spotify link">
      <button class="btn primary">Play</button>
    </form>
  </section>
  <?php endif; ?>

  <?php if ($acc): ?>
  <section class="panel">
    <div class="sec-h"><h2>Your Spotify</h2>
      <form method="post" action="music.php" class="inline"><input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="do" value="disconnect">
        <span class="meta">Connected as <b translate="no"><?= h($acc['spotify_name']) ?></b></span> <button class="btn sm ghost">Disconnect</button></form>
    </div>
    <p class="music-note" id="spPremium" hidden>Playing on this page needs Spotify Premium. Your playlists open in the player above instead.</p>
    <form class="music-link" id="spSearch">
      <input type="search" id="spQuery" placeholder="Search songs and playlists" aria-label="Search Spotify">
      <button class="btn">Search</button>
    </form>
    <div class="sp-list" id="spResults"></div>
    <h3 class="sp-h">Your playlists</h3>
    <div class="sp-list" id="spPlaylists"><p class="muted">Loading your playlists…</p></div>
  </section>
  <?php elseif ($mini): ?>
  <?php elseif ($configured): ?>
  <section class="panel">
    <h2>Connect your Spotify</h2>
    <p>See your own playlists here and play them while you plan.</p>
    <p><a class="btn primary" href="music.php?connect=1">Connect Spotify</a></p>
    <p class="music-tip">Playing inside Splanner needs Spotify Premium. While Splanner's Spotify app is in test mode, only people the site owner added in the Spotify dashboard can connect.</p>
  </section>
  <?php elseif (can_view_users($uid)): ?>
  <section class="panel">
    <h2>Let people connect their Spotify</h2>
    <p class="music-tip">Only you see this. Put SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in config.php (steps in README.md), and add this Redirect URI in the Spotify dashboard: <code translate="no"><?= h(spotify_redirect_uri()) ?></code></p>
  </section>
  <?php endif; ?>
</div>
<?php $body = ob_get_clean();

if ($mini): ?>
<!DOCTYPE html>
<html lang="en"<?= look_attr() ?>>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Music · Splanner</title>
  <link href="<?= FONT_LINK ?>" rel="stylesheet">
  <link rel="stylesheet" href="assets/style.css?v=<?= filemtime(__DIR__ . '/assets/style.css') ?>">
  <link rel="stylesheet" href="assets/looks.css?v=<?= filemtime(__DIR__ . '/assets/looks.css') ?>">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <script>try{var t=localStorage.getItem('sara-theme');if(t)document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('sara-look');if(l&&/^[a-z-]+$/.test(l)&&!document.documentElement.hasAttribute('data-look'))document.documentElement.setAttribute('data-look',l)}catch(e){}</script>
  <script src="assets/lang.js?v=<?= filemtime(__DIR__ . '/assets/lang.js') ?>"></script>
<script src="assets/icons.js?v=<?= filemtime(__DIR__ . '/assets/icons.js') ?>"></script>
<script src="assets/looks.js?v=<?= filemtime(__DIR__ . '/assets/looks.js') ?>" defer></script>
</head>
<body class="music-win">
<?= $body ?>
<script src="assets/music.js?v=<?= filemtime(__DIR__ . '/assets/music.js') ?>"></script>
</body>
</html>
<?php exit; endif;

app_top('Music', ['active' => 'music', 'eyebrow' => 'Your notebook', 'h1' => 'Music']);
echo $body; ?>
<script src="assets/music.js?v=<?= filemtime(__DIR__ . '/assets/music.js') ?>"></script>
<?php app_bottom();
