<?php
// Everything about sharing a notebook: privacy, design, blog, interest lists, likes, alerts and pictures.
// Used by api.php (the x.* actions), u.php (a shared notebook), explore.php (public notebooks) and media.php (pictures).
// People, friends, profile pictures, notebook covers and messages live in social.php / explore.php / messages.php.
declare(strict_types=1);

const SHARE_KEYS   = ['blog', 'interests', 'timetable', 'subjects'];   // kept for the old share column (used once, when moving to notebooks)
const SECTIONS     = ['interests', 'blog', 'timetable', 'subjects'];       // the pages a notebook can have, besides its cover
const NOTIFY_KEYS  = ['like'];
// Ready-made covers: plain gradients, then patterned ones (their drawings are the --cov-* variables in assets/style.css)
const ART_COVERS   = ['blossom', 'library', 'gingham', 'coquette', 'stars', 'clouds', 'lavender', 'daisy', 'checker', 'strawberry', 'terrazzo', 'waves', 'dots', 'sunsetgrain', 'matcha'];
const BANNERS      = ['dusk', 'peach', 'ocean', 'mint', 'berry', 'sunny', 'night', 'cloud', 'blossom', 'library', 'gingham', 'coquette', 'stars', 'clouds', 'lavender', 'daisy', 'checker', 'strawberry', 'terrazzo', 'waves', 'dots', 'sunsetgrain', 'matcha'];
const COVER_GRADIENTS = [
    'dusk' => ['#6A4DC4', '#E0609A'], 'peach' => ['#F9A826', '#F36B7F'], 'ocean' => ['#1F77C9', '#3FC1C9'], 'mint' => ['#4FA36B', '#B6E3C9'],
    'berry' => ['#8E2DE2', '#C2185B'], 'sunny' => ['#FFD452', '#FF9966'], 'night' => ['#1B1740', '#4B3A8F'], 'cloud' => ['#BFD7F5', '#E8DDF8'],
];
const PAPERS       = ['lined', 'grid', 'dots', 'plain'];
const PAPER_COLORS = ['white', 'cream', 'blush', 'mint', 'sky', 'lilac'];
const ACCENTS      = ['violet', 'rose', 'ocean', 'forest', 'sunset', 'graphite'];
const FONTS        = ['modern', 'hand', 'serif', 'mono'];
const BINDINGS     = ['coil', 'stitch', 'none'];
const STICKERS     = ['⭐', '💜', '🌸', '🎀', '🦋', '☁️', '🌙', '✨', '🍓', '🎧', '📚', '☕', '🐱', '🌈', '🔥', '🍒', '🎬', '🎵', '👗', '👠', '🧸', '🌷', '🍀', '💌', '📌', '✏️', '🎨', '🪩', '💫', '🍑', '🌻', '🧿'];
const LIST_EMOJI   = ['🎬', '🎤', '👗', '📚', '🍕', '🎮', '🎧', '✈️', '🐾', '💄', '🎨', '⭐'];
const MAX_NOTEBOOKS = 12;
const MAX_STYLES    = 20;

function default_design(): array
{
    return ['cover' => 'dusk', 'cover_img' => 0, 'cover_c1' => '', 'cover_c2' => '', 'paper' => 'lined', 'paper_color' => 'white', 'paper_hex' => '',
        'accent' => 'violet', 'accent_hex' => '', 'font' => 'modern', 'binding' => 'coil', 'stickers' => []];
}

function clean_hex($v): string
{
    return is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v) ? strtolower($v) : '';
}

/** Clean up whatever design the browser sent: only known values and valid colours get through. $withStickers = false for a saved style. */
function clean_design(int $uid, array $d, bool $withStickers = true): array
{
    $out = default_design();
    foreach (['paper' => PAPERS, 'font' => FONTS, 'binding' => BINDINGS] as $k => $allowed) {
        if (isset($d[$k]) && in_array($d[$k], $allowed, true)) $out[$k] = $d[$k];
    }
    foreach (['cover_c1', 'cover_c2', 'paper_hex', 'accent_hex'] as $k) $out[$k] = clean_hex($d[$k] ?? '');
    $c = $d['cover'] ?? '';
    if (in_array($c, BANNERS, true) || ($c === 'custom' && $out['cover_c1'] !== '' && $out['cover_c2'] !== '')) $out['cover'] = $c;
    $c = $d['paper_color'] ?? '';
    if (in_array($c, PAPER_COLORS, true) || ($c === 'custom' && $out['paper_hex'] !== '')) $out['paper_color'] = $c;
    $c = $d['accent'] ?? '';
    if (in_array($c, ACCENTS, true) || ($c === 'custom' && $out['accent_hex'] !== '')) $out['accent'] = $c;
    $img = (int)($d['cover_img'] ?? 0);
    if ($img > 0 && own_upload($uid, $img, 'cover')) $out['cover_img'] = $img;
    if (!$withStickers) return $out;
    foreach (array_slice((array)($d['stickers'] ?? []), 0, 30) as $s) {
        if (!is_array($s)) continue;
        $key = (string)($s['k'] ?? '');
        if (preg_match('/^up:(\d+)$/', $key, $m)) {
            if (!own_upload($uid, (int)$m[1], 'sticker')) continue;
        } elseif (!in_array($key, STICKERS, true)) {
            continue;
        }
        $page = (string)($s['p'] ?? 'cover');
        if ($page !== 'cover' && !in_array($page, SECTIONS, true) && $page !== 'day') $page = 'cover';
        $out['stickers'][] = [
            'k' => $key, 'p' => $page,
            'x' => max(0, min(100, round((float)($s['x'] ?? 50), 1))),
            'y' => max(0, min(100, round((float)($s['y'] ?? 50), 1))),
            's' => max(0.5, min(3, round((float)($s['s'] ?? 1), 1))),
            'r' => max(-180, min(180, (int)($s['r'] ?? 0))),
        ];
    }
    return $out;
}

function own_upload(int $uid, int $id, ?string $kind = null): ?array
{
    $row = q('SELECT id, kind FROM uploads WHERE id = ? AND user_id = ?', [$id, $uid])->fetch();
    if (!$row || ($kind !== null && $row['kind'] !== $kind)) return null;
    return $row;
}

/** Pictures are kept in the database and sent by media.php, which checks who may see them. */
function upload_url(?int $id): string
{
    return $id ? 'media.php?id=' . $id : '';
}

function delete_upload(int $uid, ?int $id): void
{
    if ($id && own_upload($uid, $id)) q('DELETE FROM uploads WHERE id = ?', [$id]);
}

/** May this viewer (null = not logged in) see this picture? Only if it is part of a notebook (page) they may see. */
function can_see_upload(int $id, ?int $viewer): bool
{
    $up = q('SELECT user_id FROM uploads WHERE id = ?', [$id])->fetch();
    if (!$up) return false;
    $owner = (int)$up['user_id'];
    if ($viewer !== null && $viewer === $owner) return true;
    $prof = q('SELECT * FROM profiles WHERE user_id = ?', [$owner])->fetch();
    if (!$prof || !can_view_profile($prof, $viewer)) return false;
    foreach (q('SELECT id, sections, design FROM notebooks WHERE user_id = ? AND is_public = 1', [$owner])->fetchAll() as $nb) {
        $design = json_col($nb['design'] ?? null, default_design());
        if ((int)$design['cover_img'] === $id) return true;
        foreach ((array)$design['stickers'] as $s) if (($s['k'] ?? '') === 'up:' . $id) return true;
        $sections = nb_sections($nb);
        if (in_array('blog', $sections, true) && q('SELECT 1 FROM posts WHERE user_id = ? AND notebook_id = ? AND image_id = ? AND is_public = 1', [$owner, $nb['id'], $id])->fetch()) return true;
        if (in_array('interests', $sections, true) && q('SELECT 1 FROM interest_items i JOIN interest_lists l ON l.id = i.list_id WHERE l.user_id = ? AND l.notebook_id = ? AND i.image_id = ? AND l.is_public = 1', [$owner, $nb['id'], $id])->fetch()) return true;
    }
    return false;
}

function json_col(?string $raw, array $default): array
{
    $v = $raw ? json_decode($raw, true) : null;
    return is_array($v) ? array_replace($default, $v) : $default;
}

function make_slug(string $name): string
{
    $ascii = function_exists('iconv') ? (iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name) ?: '') : $name;   // some free hosts have no iconv
    $base = strtolower(preg_replace('/[^a-z0-9]+/i', '', $ascii) ?? '');
    if (strlen($base) < 3) $base = 'user' . $base;
    $base = substr($base, 0, 24);
    do {
        $slug = $base . random_int(100, 9999);
    } while (q('SELECT 1 FROM profiles WHERE slug = ?', [$slug])->fetch());
    return $slug;
}

/**
 * The profile row of a user. It is the same table the Profile page (profile.php) uses for bio, picture and notebook
 * cover; the sharing settings are extra columns. Created (private, nothing shared) the first time it is needed.
 */
function ensure_profile(int $uid): array
{
    $row = q('SELECT * FROM profiles WHERE user_id = ?', [$uid])->fetch();
    if (!$row) {
        q('INSERT INTO profiles (user_id) VALUES (?)', [$uid]);
        $row = q('SELECT * FROM profiles WHERE user_id = ?', [$uid])->fetch();
    }
    if (empty($row['slug']) || $row['share'] === null || $row['design'] === null || $row['notify'] === null) {
        $name = (string)(q('SELECT name FROM users WHERE id = ?', [$uid])->fetch()['name'] ?? 'user');
        q('UPDATE profiles SET slug = ?, share = ?, design = ?, notify = ? WHERE user_id = ?', [
            empty($row['slug']) ? make_slug($name) : $row['slug'],
            $row['share'] ?? json_encode(['blog' => 1, 'interests' => 1, 'timetable' => 0, 'subjects' => 0]),
            $row['design'] ?? json_encode(default_design()),
            $row['notify'] ?? json_encode(['like' => 1]),
            $uid,
        ]);
        $row = q('SELECT * FROM profiles WHERE user_id = ?', [$uid])->fetch();
    }
    return $row;
}

function profile_share(array $row): array
{
    return json_col($row['share'] ?? null, ['blog' => 1, 'interests' => 1, 'timetable' => 0, 'subjects' => 0, 'day' => 1]);
}

/** Who may see today's plan: 0 nobody, 1 friends, 2 anyone signed in who can open the profile, 3 everyone who can open it (visitors too). */
function day_level(array $row): int
{
    return max(0, min(3, (int)(profile_share($row)['day'] ?? 1)));
}

/** May this viewer (null = not logged in) see this person's plan for today? */
function can_see_day(int $owner, ?int $viewer): bool
{
    if ($viewer !== null && $viewer === $owner) return true;
    $row = q('SELECT * FROM profiles WHERE user_id = ?', [$owner])->fetch();
    $level = $row ? day_level($row) : 1;
    if ($level === 0) return false;
    if ($viewer !== null && friendship($viewer, $owner) === 'friends') return true;
    if (!$row || $level < 2) return false;
    if ($level === 2 && $viewer === null) return false;
    return can_view_profile($row, $viewer);
}

function profile_design(array $row): array
{
    return json_col($row['design'] ?? null, default_design());
}

// ---------- notebooks ----------

/** The pages of a notebook, in the order the owner picked them. */
function nb_sections(array $nb): array
{
    $out = [];
    foreach (explode(',', (string)($nb['sections'] ?? '')) as $k) if (in_array($k, SECTIONS, true) && !in_array($k, $out, true)) $out[] = $k;
    return $out;
}

function clean_sections($v): array
{
    $out = [];
    foreach ((array)$v as $k) if (is_string($k) && in_array($k, SECTIONS, true) && !in_array($k, $out, true)) $out[] = $k;
    return $out;
}

function nb_design(array $nb): array
{
    return json_col($nb['design'] ?? null, default_design());
}

function nb_row(array $r): array
{
    $d = nb_design($r);
    return ['id' => (int)$r['id'], 'title' => $r['title'], 'intro' => $r['intro'], 'sections' => nb_sections($r), 'public' => (int)$r['is_public'] === 1,
        'design' => $d, 'cover_url' => upload_url($d['cover_img'] ? (int)$d['cover_img'] : null)];
}

/** A user's notebooks. $onlyPublic = what other people may see. */
function load_notebooks(int $owner, bool $onlyPublic = false): array
{
    ensure_notebooks($owner);
    $rows = q('SELECT * FROM notebooks WHERE user_id = ?' . ($onlyPublic ? ' AND is_public = 1' : '') . ' ORDER BY id', [$owner])->fetchAll();
    return array_map('nb_row', $rows);
}

function own_notebook(int $uid, int $id): array
{
    $r = q('SELECT * FROM notebooks WHERE id = ? AND user_id = ?', [$id, $uid])->fetch();
    if (!$r) fail(404, 'That notebook was not found.');
    return $r;
}

/** An optional notebook id sent with a post / list: it has to be one of your own. */
function notebook_in(int $uid, array $in): int
{
    $id = (int)($in['notebook_id'] ?? 0);
    if ($id <= 0) fail(400, 'Open a notebook first.');
    own_notebook($uid, $id);
    return $id;
}

/**
 * Everyone starts with one notebook. Accounts from before notebooks existed get one made from their old settings:
 * the pages they had switched on, their look, and (moved into it) all their posts and lists. Runs once (profiles.nb_ready).
 */
function ensure_notebooks(int $uid): void
{
    $p = ensure_profile($uid);
    if ((int)($p['nb_ready'] ?? 0) === 1) return;
    q('UPDATE profiles SET nb_ready = 1 WHERE user_id = ?', [$uid]);   // first, so a second request can't do it twice
    $share = profile_share($p);
    $hasPosts = (bool)q('SELECT 1 FROM posts WHERE user_id = ?', [$uid])->fetch();
    $hasLists = (bool)q('SELECT 1 FROM interest_lists WHERE user_id = ?', [$uid])->fetch();
    $sections = [];
    foreach (['interests', 'blog', 'timetable', 'subjects'] as $k) {
        if (!empty($share[$k]) || ($k === 'blog' && $hasPosts) || ($k === 'interests' && $hasLists)) $sections[] = $k;
    }
    if (!$sections) $sections = ['interests', 'blog'];
    // things whose page was switched off stay private
    if (empty($share['blog'])) q('UPDATE posts SET is_public = 0 WHERE user_id = ?', [$uid]);
    if (empty($share['interests'])) q('UPDATE interest_lists SET is_public = 0 WHERE user_id = ?', [$uid]);
    $design = profile_design($p);
    $design['stickers'] = array_map(fn($s) => $s + ['p' => 'cover'], (array)$design['stickers']);
    $anyShared = !empty($share['blog']) || !empty($share['interests']) || !empty($share['timetable']) || !empty($share['subjects']);
    q('INSERT INTO notebooks (user_id, title, intro, sections, design, is_public) VALUES (?, ?, ?, ?, ?, ?)',
        [$uid, 'My notebook', '', implode(',', $sections), json_encode($design), ($anyShared && (int)$p['is_public'] === 1) ? 1 : 0]);
    $id = (int)db()->lastInsertId();
    q('UPDATE posts SET notebook_id = ? WHERE user_id = ? AND notebook_id IS NULL', [$id, $uid]);
    q('UPDATE interest_lists SET notebook_id = ? WHERE user_id = ? AND notebook_id IS NULL', [$id, $uid]);
}

/** The repeating weekly plan, as [weekday => ['08:00 Lecture', ...]]. */
function load_timetable(int $owner): array
{
    $out = [];
    foreach (q('SELECT weekday, hour, text FROM weekly_hours WHERE user_id = ? AND text <> \'\' ORDER BY weekday, hour', [$owner])->fetchAll() as $r) {
        $out[(int)$r['weekday']][] = sprintf('%02d:00', $r['hour']) . ' ' . $r['text'];
    }
    return $out;
}

/** Study subjects with how far along they are (never the notes inside them). */
function load_subjects(int $owner): array
{
    $out = [];
    foreach (q('SELECT id, name FROM subjects WHERE user_id = ? ORDER BY id', [$owner])->fetchAll() as $s) {
        $c = q('SELECT COUNT(*) n, COALESCE(SUM(done), 0) d FROM chapters WHERE subject_id = ?', [$s['id']])->fetch();
        $out[] = ['name' => $s['name'], 'pct' => (int)$c['n'] ? (int)round(100 * $c['d'] / $c['n']) : 0, 'n' => (int)$c['n']];
    }
    return $out;
}

/** May this viewer (a user id, or null for a visitor who isn't logged in) open this notebook? */
function can_view_profile(array $row, ?int $viewer): bool
{
    if ($viewer !== null && $viewer === (int)$row['user_id']) return true;
    if ($viewer !== null && friendship($viewer, (int)$row['user_id']) === 'friends') return true;   // friends see the notebooks shared with them even when the account is private
    if (!(int)$row['is_public']) return false;
    return $viewer !== null || (int)$row['guest_view'] === 1;
}

function notify(int $to, string $ref, string $text, string $link): void
{
    try {
        q('INSERT INTO notifications (user_id, ref, text, link) VALUES (?, ?, ?, ?)', [$to, $ref, mb_substr($text, 0, 250), $link]);
    } catch (PDOException $e) {
        // same notification already exists (e.g. someone liked, un-liked and liked again): nothing to add
    }
}

/** Like notify(), but a newer event of the same kind replaces the older one and shows as unread again (friend requests, messages). */
function notify_replace(int $to, string $ref, string $text, string $link): void
{
    try {
        q('DELETE FROM notifications WHERE user_id = ? AND ref = ?', [$to, $ref]);
    } catch (PDOException $e) {
        return;
    }
    notify($to, $ref, $text, $link);
}

function wants_notice(int $uid, string $type): bool
{
    $row = ensure_profile($uid);
    $n = json_col($row['notify'] ?? null, ['like' => 1]);
    return !empty($n[$type]);
}

/** The page name of someone's shared notebook, or '' when their notebook is private (friends of the owner always get it). */
function public_slug(int $uid, ?int $viewer = null): string
{
    $r = q('SELECT slug, is_public FROM profiles WHERE user_id = ?', [$uid])->fetch();
    if (!$r || empty($r['slug'])) return '';
    $friends = $viewer !== null && friendship($viewer, $uid) === 'friends';
    return (int)$r['is_public'] === 1 || $friends ? (string)$r['slug'] : '';
}

function unread_count(int $uid): int
{
    try {
        return (int)q('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = 0', [$uid])->fetch()['c'];
    } catch (PDOException $e) {
        return 0;
    }
}

// ---------- pictures ----------

/** Check, shrink and store an uploaded picture in the database. Returns the new uploads id. */
function save_image(int $uid, array $file, string $kind): int
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE ? 'That picture is too big (6 MB at most).' : 'The picture did not upload. Try again.');
    }
    if ($file['size'] > 6 * 1024 * 1024) throw new RuntimeException('That picture is too big (6 MB at most).');
    if ((int)q('SELECT COUNT(*) c FROM uploads WHERE user_id = ?', [$uid])->fetch()['c'] >= 150) {
        throw new RuntimeException('You have reached the limit of 150 pictures. Delete some posts or list items first.');
    }
    $info = @getimagesize($file['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_GIF => 'image/gif', IMAGETYPE_WEBP => 'image/webp'];
    if (!$info || !isset($types[$info[2]])) throw new RuntimeException('Please choose a JPG, PNG, GIF or WebP picture.');
    if ($info[0] * $info[1] > 40_000_000) throw new RuntimeException('That picture is too large in pixels.');

    $max = ['photo' => 1280, 'cover' => 1800, 'sticker' => 320][$kind] ?? 1280;
    $bytes = null;
    $mime = $types[$info[2]];
    if (function_exists('imagecreatefromstring') && $info[2] !== IMAGETYPE_GIF) {
        // Re-draw the picture: this shrinks it and drops hidden data (camera location etc.)
        $src = @imagecreatefromstring((string)file_get_contents($file['tmp_name']));
        if ($src) {
            if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
                $exif = @exif_read_data($file['tmp_name']);
                $rot = [3 => 180, 6 => -90, 8 => 90][(int)($exif['Orientation'] ?? 1)] ?? 0;
                if ($rot) { $r = imagerotate($src, $rot, 0); if ($r) $src = $r; }
            }
            $w = imagesx($src); $h = imagesy($src);
            $scale = min(1, $max / max($w, $h));
            $nw = max(1, (int)round($w * $scale)); $nh = max(1, (int)round($h * $scale));
            $dst = imagecreatetruecolor($nw, $nh);
            $alpha = $info[2] === IMAGETYPE_PNG || $info[2] === IMAGETYPE_WEBP;
            if ($alpha) {
                imagealphablending($dst, false); imagesavealpha($dst, true);
                imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 0, 0, 0, 127));
            }
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
            ob_start();
            $ok = $alpha ? imagepng($dst, null, 7) : imagejpeg($dst, null, 82);
            $out = (string)ob_get_clean();
            if ($ok && $out !== '') { $bytes = $out; $mime = $alpha ? 'image/png' : 'image/jpeg'; }
        }
    }
    if ($bytes === null) {
        // No picture library on this host (or an animated GIF): keep the original, but only if it is small
        if ($file['size'] > 1024 * 1024) throw new RuntimeException('That picture is too big for this site to shrink. Try one under 1 MB.');
        $bytes = (string)file_get_contents($file['tmp_name']);
    }
    q('INSERT INTO uploads (user_id, kind, mime, data) VALUES (?, ?, ?, ?)', [$uid, $kind, $mime, base64_encode($bytes)]);
    return (int)db()->lastInsertId();
}

// ---------- loading ----------

function post_row(array $p, int $likes, bool $liked = false): array
{
    return [
        'id' => (int)$p['id'], 'nb' => (int)$p['notebook_id'], 'title' => $p['title'], 'body' => $p['body'],
        'image' => upload_url($p['image_id'] ? (int)$p['image_id'] : null), 'image_id' => (int)($p['image_id'] ?? 0),
        'public' => (int)$p['is_public'] === 1, 'date' => substr((string)$p['created_at'], 0, 10),
        'likes' => $likes, 'liked' => $liked,
    ];
}

/** Posts of one owner. $notebook = only that notebook's posts (0 = all of them). */
function load_posts(int $owner, bool $onlyPublic, ?int $viewer, int $notebook = 0): array
{
    $sql = 'SELECT p.*, (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes FROM posts p WHERE p.user_id = ?'
        . ($notebook ? ' AND p.notebook_id = ?' : '') . ($onlyPublic ? ' AND p.is_public = 1' : '') . ' ORDER BY p.created_at DESC, p.id DESC';
    $out = [];
    foreach (q($sql, $notebook ? [$owner, $notebook] : [$owner])->fetchAll() as $p) {
        $liked = $viewer !== null && (bool)q('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?', [$p['id'], $viewer])->fetch();
        $out[] = post_row($p, (int)$p['likes'], $liked);
    }
    return $out;
}

function load_lists(int $owner, bool $onlyPublic, int $notebook = 0): array
{
    $lists = q('SELECT * FROM interest_lists WHERE user_id = ?' . ($notebook ? ' AND notebook_id = ?' : '') . ($onlyPublic ? ' AND is_public = 1' : '') . ' ORDER BY id',
        $notebook ? [$owner, $notebook] : [$owner])->fetchAll();
    $out = [];
    foreach ($lists as $l) {
        $items = [];
        foreach (q('SELECT * FROM interest_items WHERE list_id = ? ORDER BY id', [$l['id']])->fetchAll() as $it) {
            $items[] = ['id' => (int)$it['id'], 'text' => $it['text'], 'note' => $it['note'],
                'image' => upload_url($it['image_id'] ? (int)$it['image_id'] : null), 'image_id' => (int)($it['image_id'] ?? 0)];
        }
        $out[] = ['id' => (int)$l['id'], 'nb' => (int)$l['notebook_id'], 'title' => $l['title'], 'emoji' => $l['emoji'], 'layout' => $l['layout'],
            'public' => (int)$l['is_public'] === 1, 'items' => $items];
    }
    return $out;
}

function load_notifications(int $uid): array
{
    $out = [];
    foreach (q('SELECT id, ref, text, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60', [$uid])->fetchAll() as $n) {
        $out[] = ['id' => (int)$n['id'], 'kind' => explode(':', (string)$n['ref'])[0], 'text' => $n['text'], 'link' => $n['link'], 'read' => (int)$n['is_read'] === 1, 'at' => (string)$n['created_at']];
    }
    return $out;
}

function load_styles(int $uid): array
{
    return array_map(fn($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'design' => json_col($r['design'], default_design())],
        q('SELECT * FROM notebook_styles WHERE user_id = ? ORDER BY id', [$uid])->fetchAll());
}

function notebook_bootstrap(int $uid): array
{
    $p = ensure_profile($uid);
    ensure_notebooks($uid);
    $notify = json_col($p['notify'] ?? null, ['like' => 1]);
    $me = person($uid);
    $friends = [];
    foreach (array_slice(friend_ids($uid), 0, 100) as $fid) {
        if ($f = person($fid)) $friends[] = ['id' => $fid, 'name' => $f['name'], 'avatar' => $f['avatar_v'] ? 'avatar.php?id=' . $fid . '&v=' . $f['avatar_v'] : ''];
    }
    $plan = [];
    foreach (day_schedule($uid, date('Y-m-d')) as $e) {
        $t = isset(HOUR_COLORS[$e['type']]) ? $e['type'] : 'personal';
        $plan[] = ['from' => $e['from'], 'to' => min($e['to'], 1440), 'text' => $e['text'], 'label' => HOUR_NAMES[$t], 'color' => HOUR_COLORS[$t]];
    }
    return [
        'profile' => ['slug' => $p['slug'], 'bio' => $p['bio'], 'public' => (int)$p['is_public'] === 1, 'guest' => (int)$p['guest_view'] === 1,
            'notify' => $notify, 'friends' => count($friends), 'name' => $me['name'], 'day' => day_level($p),
            'avatar' => $me['avatar_v'] ? 'avatar.php?id=' . $uid . '&v=' . $me['avatar_v'] : ''],
        'friends' => $friends, 'me_id' => $uid,
        'plan' => ['date' => date('l, j F'), 'now' => (int)date('G') * 60 + (int)date('i'), 'items' => $plan],
        'notebooks' => load_notebooks($uid),
        'styles' => load_styles($uid),
        'stickers_up' => array_map(fn($r) => ['id' => (int)$r['id'], 'url' => upload_url((int)$r['id'])],
            q("SELECT id FROM uploads WHERE user_id = ? AND kind = 'sticker' ORDER BY id DESC LIMIT 40", [$uid])->fetchAll()),
        'posts' => load_posts($uid, false, $uid),
        'lists' => load_lists($uid, false),
        'timetable' => load_timetable($uid),
        'subjects' => load_subjects($uid),
        'notes' => load_notifications($uid),
        'unread' => unread_count($uid),
    ];
}

// ---------- actions (called from api.php) ----------

function own_list(int $uid, int $id): array
{
    $r = q('SELECT * FROM interest_lists WHERE id = ? AND user_id = ?', [$id, $uid])->fetch();
    if (!$r) fail(404, 'That list was not found.');
    return $r;
}

function own_post(int $uid, int $id): array
{
    $r = q('SELECT * FROM posts WHERE id = ? AND user_id = ?', [$id, $uid])->fetch();
    if (!$r) fail(404, 'That post was not found.');
    return $r;
}

/** An optional picture id sent with a post / list item: it has to be one of your own photos. */
function photo_in(int $uid, array $in, string $key = 'image_id'): ?int
{
    $id = (int)($in[$key] ?? 0);
    if ($id <= 0) return null;
    return own_upload($uid, $id, 'photo') ? $id : null;
}

/** Drop a deleted picture from every notebook design and saved style that uses it. */
function forget_upload(int $uid, int $id): void
{
    foreach (q('SELECT id, design FROM notebooks WHERE user_id = ?', [$uid])->fetchAll() as $nb) {
        $d = nb_design($nb);
        $old = json_encode($d);
        if ((int)$d['cover_img'] === $id) $d['cover_img'] = 0;
        $d['stickers'] = array_values(array_filter((array)$d['stickers'], fn($s) => ($s['k'] ?? '') !== 'up:' . $id));
        if (json_encode($d) !== $old) q('UPDATE notebooks SET design = ? WHERE id = ?', [json_encode($d), $nb['id']]);
    }
    foreach (q('SELECT id, design FROM notebook_styles WHERE user_id = ?', [$uid])->fetchAll() as $st) {
        $d = json_col($st['design'], default_design());
        if ((int)$d['cover_img'] === $id) { $d['cover_img'] = 0; q('UPDATE notebook_styles SET design = ? WHERE id = ?', [json_encode($d), $st['id']]); }
    }
    $p = ensure_profile($uid);
    $d = profile_design($p);
    if ((int)$d['cover_img'] === $id) { $d['cover_img'] = 0; q('UPDATE profiles SET design = ? WHERE user_id = ?', [json_encode($d), $uid]); }
}

function notebook_action(int $uid, string $action, array $in): void
{
    switch ($action) {
    case 'x.load':
        ok(notebook_bootstrap($uid));

    case 'x.profile.save': {
        $p = ensure_profile($uid);
        if (array_key_exists('slug', $in)) {
            $slug = strtolower(trim((string)$in['slug']));
            if (!preg_match('/^[a-z0-9_]{3,30}$/', $slug)) fail(400, 'The page name can use 3–30 letters, numbers and _ only.');
            $taken = q('SELECT user_id FROM profiles WHERE slug = ? AND user_id <> ?', [$slug, $uid])->fetch();
            if ($taken) fail(409, 'Someone already uses that page name. Try another.');
            q('UPDATE profiles SET slug = ? WHERE user_id = ?', [$slug, $uid]);
        }
        if (array_key_exists('bio', $in)) q('UPDATE profiles SET bio = ? WHERE user_id = ?', [mb_substr(trim((string)$in['bio']), 0, 300), $uid]);
        if (array_key_exists('public', $in)) q('UPDATE profiles SET is_public = ? WHERE user_id = ?', [!empty($in['public']) ? 1 : 0, $uid]);
        if (array_key_exists('guest', $in)) q('UPDATE profiles SET guest_view = ? WHERE user_id = ?', [!empty($in['guest']) ? 1 : 0, $uid]);
        if (array_key_exists('day', $in)) {   // who may see today's hour-by-hour plan (0-3, see day_level)
            $sh = profile_share($p);
            $sh['day'] = max(0, min(3, (int)$in['day']));
            q('UPDATE profiles SET share = ? WHERE user_id = ?', [json_encode($sh), $uid]);
        }
        if (isset($in['notify']) && is_array($in['notify'])) {
            $n = json_col($p['notify'] ?? null, ['like' => 1]);
            foreach (NOTIFY_KEYS as $k) if (array_key_exists($k, $in['notify'])) $n[$k] = !empty($in['notify'][$k]) ? 1 : 0;
            q('UPDATE profiles SET notify = ? WHERE user_id = ?', [json_encode($n), $uid]);
        }
        ok();
    }

    // ----- notebooks -----
    case 'x.nb.add': {
        ensure_notebooks($uid);
        if ((int)q('SELECT COUNT(*) c FROM notebooks WHERE user_id = ?', [$uid])->fetch()['c'] >= MAX_NOTEBOOKS) fail(400, 'That is plenty of notebooks! Delete one first.');
        $title = str_in($in, 'title', 80);
        $sections = clean_sections($in['sections'] ?? []);
        $design = clean_design($uid, (array)($in['design'] ?? []), false);
        q('INSERT INTO notebooks (user_id, title, sections, design, is_public) VALUES (?, ?, ?, ?, 0)', [$uid, $title, implode(',', $sections), json_encode($design)]);
        $id = (int)db()->lastInsertId();
        ok(['notebook' => nb_row(own_notebook($uid, $id))]);
    }

    case 'x.nb.save': {
        $id = id_in($in);
        own_notebook($uid, $id);
        if (array_key_exists('title', $in)) q('UPDATE notebooks SET title = ? WHERE id = ?', [str_in($in, 'title', 80), $id]);
        if (array_key_exists('intro', $in)) q('UPDATE notebooks SET intro = ? WHERE id = ?', [mb_substr(trim((string)$in['intro']), 0, 300), $id]);
        if (array_key_exists('sections', $in)) q('UPDATE notebooks SET sections = ? WHERE id = ?', [implode(',', clean_sections($in['sections'])), $id]);
        if (array_key_exists('public', $in)) q('UPDATE notebooks SET is_public = ? WHERE id = ?', [!empty($in['public']) ? 1 : 0, $id]);
        ok(['notebook' => nb_row(own_notebook($uid, $id))]);
    }

    case 'x.nb.design': {
        $id = id_in($in);
        own_notebook($uid, $id);
        $d = clean_design($uid, (array)($in['design'] ?? []));
        q('UPDATE notebooks SET design = ? WHERE id = ?', [json_encode($d), $id]);
        ok(['design' => $d, 'cover_url' => upload_url($d['cover_img'] ? (int)$d['cover_img'] : null)]);
    }

    case 'x.nb.planner': {   // use a notebook's look (not its stickers) for the planner itself
        $nb = own_notebook($uid, id_in($in));
        ensure_profile($uid);
        $d = clean_design($uid, nb_design($nb), false);
        q('UPDATE profiles SET design = ? WHERE user_id = ?', [json_encode($d), $uid]);
        ok();
    }

    case 'x.nb.delete': {
        $id = id_in($in);
        own_notebook($uid, $id);
        foreach (q('SELECT image_id FROM posts WHERE notebook_id = ? AND user_id = ? AND image_id IS NOT NULL', [$id, $uid])->fetchAll() as $r) delete_upload($uid, (int)$r['image_id']);
        q('DELETE FROM posts WHERE notebook_id = ? AND user_id = ?', [$id, $uid]);
        foreach (q('SELECT i.image_id FROM interest_items i JOIN interest_lists l ON l.id = i.list_id WHERE l.notebook_id = ? AND l.user_id = ? AND i.image_id IS NOT NULL', [$id, $uid])->fetchAll() as $r) delete_upload($uid, (int)$r['image_id']);
        foreach (q('SELECT id FROM interest_lists WHERE notebook_id = ? AND user_id = ?', [$id, $uid])->fetchAll() as $r) {
            q('DELETE FROM interest_items WHERE list_id = ?', [$r['id']]);
            q('DELETE FROM interest_lists WHERE id = ?', [$r['id']]);
        }
        q('DELETE FROM notebooks WHERE id = ?', [$id]);
        ok();
    }

    // ----- "my styles": looks saved to reuse -----
    case 'x.style.save': {
        if ((int)q('SELECT COUNT(*) c FROM notebook_styles WHERE user_id = ?', [$uid])->fetch()['c'] >= MAX_STYLES) fail(400, 'You have saved plenty of styles. Delete one first.');
        $d = clean_design($uid, (array)($in['design'] ?? []), false);
        q('INSERT INTO notebook_styles (user_id, name, design) VALUES (?, ?, ?)', [$uid, str_in($in, 'name', 60), json_encode($d)]);
        ok(['styles' => load_styles($uid)]);
    }

    case 'x.style.delete':
        q('DELETE FROM notebook_styles WHERE id = ? AND user_id = ?', [id_in($in), $uid]);
        ok(['styles' => load_styles($uid)]);

    case 'x.upload.delete': {
        $id = id_in($in);
        $row = own_upload($uid, $id);
        if (!$row) fail(404, 'Picture not found.');
        // pictures that are still used somewhere stay; this is for stickers and covers you no longer want
        forget_upload($uid, $id);
        q('UPDATE posts SET image_id = NULL WHERE image_id = ? AND user_id = ?', [$id, $uid]);
        q('UPDATE interest_items SET image_id = NULL WHERE image_id = ? AND list_id IN (SELECT id FROM interest_lists WHERE user_id = ?)', [$id, $uid]);
        delete_upload($uid, $id);
        ok(['notebooks' => load_notebooks($uid)]);
    }

    // ----- blog posts and interest lists (each belongs to one notebook) -----
    case 'x.post.save': {
        $title = str_in($in, 'title', 150);
        $body = mb_substr(trim((string)($in['body'] ?? '')), 0, 20000);
        if ($body === '') fail(400, 'Please write something in your post.');
        $public = !empty($in['public']) ? 1 : 0;
        $img = photo_in($uid, $in);
        $id = (int)($in['id'] ?? 0);
        if ($id > 0) {
            $old = own_post($uid, $id);
            q('UPDATE posts SET title = ?, body = ?, is_public = ?, image_id = ? WHERE id = ?', [$title, $body, $public, $img, $id]);
            if ($old['image_id'] && (int)$old['image_id'] !== $img) delete_upload($uid, (int)$old['image_id']);
            ok(['id' => $id]);
        }
        $nb = notebook_in($uid, $in);
        q('INSERT INTO posts (user_id, notebook_id, title, body, image_id, is_public) VALUES (?, ?, ?, ?, ?, ?)', [$uid, $nb, $title, $body, $img, $public]);
        ok(['id' => (int)db()->lastInsertId()]);
    }

    case 'x.post.public': {
        $id = id_in($in);
        own_post($uid, $id);
        q('UPDATE posts SET is_public = ? WHERE id = ?', [!empty($in['public']) ? 1 : 0, $id]);
        ok();
    }

    case 'x.post.delete': {
        $id = id_in($in);
        $p = own_post($uid, $id);
        q('DELETE FROM posts WHERE id = ?', [$id]);
        if ($p['image_id']) delete_upload($uid, (int)$p['image_id']);
        ok();
    }

    case 'x.list.add': {
        $nb = notebook_in($uid, $in);
        $title = str_in($in, 'title', 80);
        $emoji = in_array($in['emoji'] ?? '', LIST_EMOJI, true) ? $in['emoji'] : '';
        $layout = ($in['layout'] ?? '') === 'grid' ? 'grid' : 'list';
        if ((int)q('SELECT COUNT(*) c FROM interest_lists WHERE user_id = ?', [$uid])->fetch()['c'] >= 40) fail(400, 'That is plenty of lists! Delete one first.');
        q('INSERT INTO interest_lists (user_id, notebook_id, title, emoji, layout, is_public) VALUES (?, ?, ?, ?, ?, ?)', [$uid, $nb, $title, $emoji, $layout, !empty($in['public']) ? 1 : 0]);
        ok(['id' => (int)db()->lastInsertId()]);
    }

    case 'x.list.update': {
        $id = id_in($in);
        own_list($uid, $id);
        if (array_key_exists('title', $in)) q('UPDATE interest_lists SET title = ? WHERE id = ?', [str_in($in, 'title', 80), $id]);
        if (array_key_exists('layout', $in)) q('UPDATE interest_lists SET layout = ? WHERE id = ?', [$in['layout'] === 'grid' ? 'grid' : 'list', $id]);
        if (array_key_exists('public', $in)) q('UPDATE interest_lists SET is_public = ? WHERE id = ?', [!empty($in['public']) ? 1 : 0, $id]);
        ok();
    }

    case 'x.list.delete': {
        $id = id_in($in);
        own_list($uid, $id);
        foreach (q('SELECT image_id FROM interest_items WHERE list_id = ? AND image_id IS NOT NULL', [$id])->fetchAll() as $r) delete_upload($uid, (int)$r['image_id']);
        q('DELETE FROM interest_lists WHERE id = ?', [$id]);
        ok();
    }

    case 'x.item.add': {
        $lid = id_in($in, 'list_id');
        own_list($uid, $lid);
        $text = str_in($in, 'text', 150);
        $note = mb_substr(trim((string)($in['note'] ?? '')), 0, 300);
        if ((int)q('SELECT COUNT(*) c FROM interest_items WHERE list_id = ?', [$lid])->fetch()['c'] >= 300) fail(400, 'That list is full.');
        q('INSERT INTO interest_items (list_id, text, note, image_id) VALUES (?, ?, ?, ?)', [$lid, $text, $note, photo_in($uid, $in)]);
        ok(['id' => (int)db()->lastInsertId()]);
    }

    case 'x.item.delete': {
        $id = id_in($in);
        $it = q('SELECT i.* FROM interest_items i JOIN interest_lists l ON l.id = i.list_id WHERE i.id = ? AND l.user_id = ?', [$id, $uid])->fetch();
        if (!$it) fail(404, 'That item was not found.');
        q('DELETE FROM interest_items WHERE id = ?', [$id]);
        if ($it['image_id']) delete_upload($uid, (int)$it['image_id']);
        ok();
    }

    case 'x.like': {
        $pid = id_in($in, 'post_id');
        $post = q('SELECT * FROM posts WHERE id = ?', [$pid])->fetch();
        if (!$post) fail(404, 'That post was not found.');
        $owner = (int)$post['user_id'];
        $prof = ensure_profile($owner);
        if ($owner !== $uid) {
            $nb = q('SELECT * FROM notebooks WHERE id = ? AND user_id = ? AND is_public = 1', [(int)$post['notebook_id'], $owner])->fetch();
            if (!$nb || !in_array('blog', nb_sections($nb), true) || !can_view_profile($prof, $uid) || !(int)$post['is_public']) fail(404, 'That post is private.');
        }
        $have = q('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?', [$pid, $uid])->fetch();
        if ($have) {
            q('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [$pid, $uid]);
        } else {
            q('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [$pid, $uid]);
            if ($owner !== $uid && wants_notice($owner, 'like')) {
                $name = (string)q('SELECT name FROM users WHERE id = ?', [$uid])->fetch()['name'];
                notify($owner, "like:$pid:$uid", "$name liked your post “" . mb_substr($post['title'], 0, 60) . '”.', '');
            }
        }
        ok(['liked' => !$have, 'likes' => (int)q('SELECT COUNT(*) c FROM post_likes WHERE post_id = ?', [$pid])->fetch()['c']]);
    }

    case 'x.notes':
        ok(['notes' => load_notifications($uid), 'unread' => unread_count($uid)]);

    case 'x.notes.read':
        q('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [$uid]);
        ok(['unread' => 0]);

    case 'x.notes.clear':
        q('DELETE FROM notifications WHERE user_id = ?', [$uid]);
        ok(['unread' => 0]);

    default:
        fail(404, 'Unknown action.');
    }
}
