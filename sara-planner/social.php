<?php
// Shared helpers for people, profiles and friends (explore.php, profile.php, friend.php, chat).
declare(strict_types=1);

// Notebook covers: [name, style]. Vintage ones have a name label, spiral ones show your cover words in script.
// The drawings are in assets/covers.css.
const COVERS = [
    'meadow' => ['Wildflowers', 'vintage'], 'cherry' => ['Cherries & bows', 'top'], 'autumn' => ['Autumn leaves', 'vintage'],
    'woodland' => ['Woodland', 'vintage'], 'cocoa' => ['Pressed ferns', 'vintage'], 'rose' => ['Rose vine', 'vintage'],
    'blush' => ['Blush', 'spiral'], 'petal' => ['Pink bow', 'spiral'], 'rosewood' => ['Rosewood', 'spiral'],
    'ivory' => ['White & bow', 'spiral'], 'nude' => ['Nude', 'spiral'],
    'art-blossom' => ['Cherry blossom', 'top'],
    'art-library' => ['Dark academia', 'vintage'],
    'art-gingham' => ['Gingham', 'top'],
    'art-coquette' => ['Bows', 'top'],
    'art-stars' => ['Starry night', 'spiral'],
    'art-clouds' => ['Clouds', 'top'],
    'art-lavender' => ['Lavender', 'top'],
    'art-daisy' => ['Daisies', 'top'],
    'art-checker' => ['Checkerboard', 'top'],
    'art-strawberry' => ['Strawberries', 'top'],
    'art-terrazzo' => ['Terrazzo', 'vintage'],
    'art-waves' => ['Waves', 'spiral'],
    'art-dots' => ['Polka dots', 'top'],
    'art-sunsetgrain' => ['Sunset', 'spiral'],
    'art-matcha' => ['Matcha', 'spiral'],
    'art-hearts' => ['Hearts', 'vintage'],
    'art-rainbow' => ['Rainbows', 'vintage'],
    'art-mountains' => ['Mountains', 'vintage'],
    'art-pinstripe' => ['Pinstripe', 'vintage'],
    'art-monstera' => ['Monstera', 'vintage'],
];
const DEFAULT_COVER = 'meadow';
// Hour types and the colour each one has in the planner (same as HT in assets/app.js)
const HOUR_COLORS = ['uni' => 'school', 'work' => 'transport', 'study' => 'food', 'personal' => 'fun',
    'health' => 'groceries', 'sleep' => 'other'];
const HOUR_NAMES = ['uni' => 'Uni', 'work' => 'Work', 'study' => 'Study', 'personal' => 'Personal',
    'health' => 'Health', 'sleep' => 'Sleep'];

/** Turn an uploaded picture into a 256×256 JPEG (cropped to a square). Returns "image/jpeg;<base64>" or an error. */
function avatar_from_upload(array $f): array
{
    if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE || $f['size'] > 5 * 1024 * 1024) {
        return [null, 'That picture is too big. Pick one under 5 MB.'];
    }
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) return [null, 'The picture could not be uploaded. Try again.'];
    $info = @getimagesize($f['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp', IMAGETYPE_GIF => 'image/gif'];
    if (!$info || !isset($types[$info[2]])) return [null, 'Pick a JPG, PNG, WebP or GIF picture.'];
    $raw = file_get_contents($f['tmp_name']);

    if (function_exists('imagecreatefromstring') && ($src = @imagecreatefromstring($raw))) {
        $w = imagesx($src); $hgt = imagesy($src); $side = min($w, $hgt);
        $dst = imagecreatetruecolor(256, 256);
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));   // transparent PNGs get a white background
        imagecopyresampled($dst, $src, 0, 0, intdiv($w - $side, 2), intdiv($hgt - $side, 2), 256, 256, $side, $side);
        ob_start();
        imagejpeg($dst, null, 85);
        return ['image/jpeg;' . base64_encode((string)ob_get_clean()), ''];
    }
    // Host without the GD image library: keep the file as it is, if it's small
    if (strlen($raw) > 600 * 1024) return [null, 'That picture is too big. Pick one under 600 KB.'];
    return [$types[$info[2]] . ';' . base64_encode($raw), ''];
}

/** Does this account have the blue verified tick? (given by an admin on admin.php) */
function is_verified_badge(int $id): bool
{
    try {
        return (int)(q('SELECT verified_badge FROM users WHERE id = ?', [$id])->fetch()['verified_badge'] ?? 0) === 1;
    } catch (PDOException $e) {   // column couldn't be added on this host
        return false;
    }
}

/** The small blue tick next to the name of a verified account. */
function vbadge(bool $on): string
{
    return $on ? ' <span class="vbadge" title="Verified account" aria-label="Verified account">✓</span>' : '';
}

/** Name, bio, cover and picture version of one user, or null if the account doesn't exist. */
function person(int $id): ?array
{
    $u = q('SELECT id, name, email FROM users WHERE id = ?', [$id])->fetch();
    if (!$u) return null;
    $u['verified'] = is_verified_badge($id);
    try {
        $p = q('SELECT bio, cover, words, avatar_v, cover_img FROM profiles WHERE user_id = ?', [$id])->fetch();
    } catch (PDOException $e) {   // words / cover_img column couldn't be added on this host
        $p = q("SELECT bio, cover, '' AS words, avatar_v, NULL AS cover_img FROM profiles WHERE user_id = ?", [$id])->fetch();
    }
    $p = $p ?: ['bio' => '', 'cover' => DEFAULT_COVER, 'words' => '', 'avatar_v' => 0, 'cover_img' => null];
    return ['id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'], 'bio' => $p['bio'],
        'cover' => isset(COVERS[$p['cover']]) || ($p['cover'] === 'custom' && $p['cover_img']) ? $p['cover'] : DEFAULT_COVER, 'cover_img' => $p['cover_img'] ? (int)$p['cover_img'] : 0, 'words' => (string)$p['words'], 'avatar_v' => (int)$p['avatar_v'],
        'same_name' => same_name_count($u['name']) > 1, 'verified' => $u['verified']];
}

/** How many accounts use this name. When it's more than one, the email is shown next to it to tell them apart. */
function same_name_count(string $name): int
{
    static $cache = [];
    $k = mb_strtolower(trim($name));
    return $cache[$k] ??= (int)q('SELECT COUNT(*) AS n FROM users WHERE LOWER(TRIM(name)) = ?', [$k])->fetch()['n'];
}

/** The email to show under someone's name, or '' when their name is unique on the site. */
function name_tag(string $name, string $email): string
{
    return same_name_count($name) > 1 ? $email : '';
}

/** 'friends', 'sent' (I asked, waiting), 'received' (they asked me) or 'none'. */
function friendship(int $me, int $other): string
{
    $a = q('SELECT accepted FROM friends WHERE from_id = ? AND to_id = ?', [$me, $other])->fetch();
    $b = q('SELECT accepted FROM friends WHERE from_id = ? AND to_id = ?', [$other, $me])->fetch();
    if (($a && (int)$a['accepted']) || ($b && (int)$b['accepted'])) return 'friends';
    if ($a) return 'sent';
    if ($b) return 'received';
    return 'none';
}

/** Ids of everyone this user is friends with. */
function friend_ids(int $uid): array
{
    $rows = q('SELECT CASE WHEN from_id = ? THEN to_id ELSE from_id END AS other FROM friends
               WHERE accepted = 1 AND (from_id = ? OR to_id = ?)', [$uid, $uid, $uid])->fetchAll();
    return array_map(fn($r) => (int)$r['other'], $rows);
}

/** Friend requests waiting for this user's answer (0 if the table couldn't be made on this host). */
function friend_requests_count(int $uid): int
{
    try {
        return (int)q('SELECT COUNT(*) AS n FROM friends WHERE to_id = ? AND accepted = 0', [$uid])->fetch()['n'];
    } catch (PDOException $e) {
        return 0;
    }
}

/** A round profile picture, or the first letter of the name when there's no picture. */
function avatar_html(array $p, string $size = ''): string
{
    $cls = 'avatar' . ($size ? ' ' . $size : '');
    if ($p['avatar_v']) {
        return '<img class="' . $cls . '" src="avatar.php?id=' . $p['id'] . '&amp;v=' . $p['avatar_v'] . '" alt="">';
    }
    $letter = mb_strtoupper(mb_substr(trim($p['name']), 0, 1)) ?: '?';
    return '<span class="' . $cls . ' letter" aria-hidden="true">' . h($letter) . '</span>';
}

/** A person's notebook cover. $mini = just the pattern, for the cover picker. */
function cover_html(array $p, bool $mini = false, ?string $cover = null): string
{
    $cover = $cover ?? $p['cover'];
    $custom = $cover === 'custom' && !empty($p['cover_img']);
    if (!$custom && !isset(COVERS[$cover])) $cover = DEFAULT_COVER;
    $style = $custom ? 'top' : COVERS[$cover][1];
    $cls = 'nbc cv-' . $cover . ($style === 'spiral' ? ' spiral' : '') . ($style === 'top' ? ' top' : '') . ($mini ? ' mini' : '');
    $lightSpine = in_array($cover, ['cherry', 'rose'], true) ? ' light' : '';
    $art = $custom ? ' style="background-image:url(\'' . h((string)upload_url((int)$p['cover_img'])) . '\');background-size:cover;background-position:center"' : '';
    $out = '<span class="' . $cls . '" aria-hidden="true"><span class="nbc-art"' . $art . '></span><span class="nbc-spine' . $lightSpine . '"></span>';
    if (!$mini) {
        if ($style === 'spiral') {
            $words = trim($p['words']);
            $out .= '<span class="nbc-words">' . (in_array($cover, ['petal', 'ivory'], true) ? '<span class="nbc-bowtop"></span>' : '')
                . '<span class="nbc-script" translate="no">' . h($words !== '' ? $words : $p['name']) . '</span>'
                . avatar_html($p) . '<span class="nbc-small" translate="no">' . ($words !== '' ? h($p['name']) : '') . '</span></span>';
        } else {
            $out .= '<span class="nbc-label">' . avatar_html($p) . '<span class="nbc-name" translate="no">' . h($p['name']) . '</span>'
                . '<span class="nbc-orn"></span><span class="nbc-dots"></span></span>';
        }
    }
    return $out . '</span>';
}

/** Name, plus the email underneath when someone else has the same name. */
function name_html(array $p): string
{
    return '<span class="pname">' . h($p['name']) . '</span>' . vbadge(!empty($p['verified']))
        . ($p['same_name'] ? '<span class="pmail" translate="no">' . h($p['email']) . '</span>' : '');
}

/**
 * One user's hour-by-hour plan for a day, the same way their planner shows it: that day's own entries,
 * else the weekly ones. Hours that run on (17:15–19:45) are joined into one entry.
 * Returns [['from' => minutes, 'to' => minutes, 'text' => ..., 'type' => ...], ...]
 */
function day_schedule(int $uid, string $date): array
{
    $wd = ((int)date('N', strtotime($date))) - 1;
    $day = $week = [];
    foreach (q('SELECT hour, text, type, start_min, end_min FROM hours WHERE user_id = ? AND date = ?', [$uid, $date]) as $r) $day[(int)$r['hour']] = $r;
    foreach (q('SELECT hour, text, type, start_min, end_min FROM weekly_hours WHERE user_id = ? AND weekday = ?', [$uid, $wd]) as $r) $week[(int)$r['hour']] = $r;
    $out = [];
    $prev = null;
    for ($h = 0; $h < 24; $h++) {
        $e = $day[$h] ?? $week[$h] ?? null;
        if (!$e || trim((string)$e['text']) === '') { $prev = null; continue; }
        $from = $h * 60 + (int)$e['start_min'];
        $to   = $h * 60 + (int)$e['end_min'];
        $last = count($out) - 1;
        if ($prev && (int)$prev['end_min'] === 60 && (int)$e['start_min'] === 0
            && $prev['text'] === $e['text'] && $prev['type'] === $e['type']) {
            $out[$last]['to'] = $to;          // the same entry carrying on into this hour
        } else {
            $out[] = ['from' => $from, 'to' => $to, 'text' => $e['text'], 'type' => $e['type']];
        }
        $prev = $e;
    }
    return $out;
}

function hm(int $min): string
{
    return sprintf('%02d:%02d', intdiv($min, 60), $min % 60);
}

const FREE_FROM = 8 * 60;    // free time is only counted between 08:00 and 23:00
const FREE_TO   = 23 * 60;

/** The minutes of a day when someone has nothing planned, as [[from, to], ...] between 08:00 and 23:00 (from $after on, for today). */
function free_slots(int $uid, string $date, int $after = 0): array
{
    $free = [[max(FREE_FROM, $after), FREE_TO]];
    foreach (day_schedule($uid, $date) as $e) {
        $next = [];
        foreach ($free as [$a, $b]) {
            if ($e['to'] <= $a || $e['from'] >= $b) { $next[] = [$a, $b]; continue; }
            if ($e['from'] > $a) $next[] = [$a, $e['from']];
            if ($e['to'] < $b) $next[] = [$e['to'], $b];
        }
        $free = $next;
    }
    return array_values(array_filter($free, fn($s) => $s[1] > $s[0]));
}

/** The stretches of time that are in both lists, at least $min minutes long. */
function common_slots(array $a, array $b, int $min = 30): array
{
    $out = [];
    foreach ($a as [$a1, $a2]) foreach ($b as [$b1, $b2]) {
        $from = max($a1, $b1); $to = min($a2, $b2);
        if ($to - $from >= $min) $out[] = [$from, $to];
    }
    usort($out, fn($x, $y) => $x[0] <=> $y[0]);
    return $out;
}


/**
 * People whose notebooks a visitor without an account may open: a public profile with "visible without logging in" switched on,
 * a page name, and at least one notebook shared. Returns [ ['name','slug','bio','nbs'=>[notebook...]], ... ].
 */
function guest_people(int $limit = 12, string $term = ''): array
{
    $sql = 'SELECT u.id, u.name, p.slug, p.bio FROM users u JOIN profiles p ON p.user_id = u.id
            WHERE u.email_verified = 1 AND p.is_public = 1 AND p.guest_view = 1 AND p.slug IS NOT NULL AND p.slug <> \'\' AND COALESCE(p.in_explore, 0) = 1';
    $args = [];
    if ($term !== '') {
        $sql .= " AND u.name LIKE ? ESCAPE '|'";
        $args[] = '%' . str_replace(['|', '%', '_'], ['||', '|%', '|_'], $term) . '%';
    }
    $out = [];
    foreach (q($sql . ' ORDER BY u.name LIMIT 200', $args)->fetchAll() as $r) {
        $nbs = load_notebooks((int)$r['id'], true);   // only the notebooks the owner shared
        if (!$nbs) continue;
        $r['nbs'] = $nbs;
        $out[] = $r;
        if (count($out) >= $limit) break;
    }
    return $out;
}
