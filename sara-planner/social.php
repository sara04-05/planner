<?php
// Everything about sharing a notebook: profile + privacy, design, blog, interest lists, follows, notifications.
// Used by api.php (the x.* actions), u.php (a public notebook) and people.php (the directory).
declare(strict_types=1);

const SHARE_KEYS   = ['blog', 'interests', 'timetable', 'subjects'];
const NOTIFY_KEYS  = ['follow', 'like', 'dm'];
const COVERS       = ['dusk', 'peach', 'ocean', 'mint', 'berry', 'sunny', 'night', 'cloud'];
const PAPERS       = ['lined', 'grid', 'dots', 'plain'];
const PAPER_COLORS = ['white', 'cream', 'blush', 'mint', 'sky', 'lilac'];
const ACCENTS      = ['violet', 'rose', 'ocean', 'forest', 'sunset', 'graphite'];
const FONTS        = ['modern', 'hand', 'serif', 'mono'];
const STICKERS     = ['⭐', '💜', '🌸', '🎀', '🦋', '☁️', '🌙', '✨', '🍓', '🎧', '📚', '☕', '🐱', '🌈', '🔥', '🍒', '🎬', '🎵', '👗', '👠', '🧸', '🌷', '🍀', '💌', '📌', '✏️', '🎨', '🪩', '💫', '🍑', '🌻', '🧿'];
const LIST_EMOJI   = ['🎬', '🎤', '👗', '📚', '🍕', '🎮', '🎧', '✈️', '🐾', '💄', '🎨', '⭐'];

function default_design(): array
{
    return ['cover' => 'dusk', 'cover_img' => 0, 'paper' => 'lined', 'paper_color' => 'white', 'accent' => 'violet', 'font' => 'modern', 'stickers' => []];
}

/** Clean up whatever design the browser sent: only known values get through. */
function clean_design(int $uid, array $d): array
{
    $out = default_design();
    foreach (['cover' => COVERS, 'paper' => PAPERS, 'paper_color' => PAPER_COLORS, 'accent' => ACCENTS, 'font' => FONTS] as $k => $allowed) {
        if (isset($d[$k]) && in_array($d[$k], $allowed, true)) $out[$k] = $d[$k];
    }
    $img = (int)($d['cover_img'] ?? 0);
    if ($img > 0 && own_upload($uid, $img, 'cover')) $out['cover_img'] = $img;
    foreach (array_slice((array)($d['stickers'] ?? []), 0, 24) as $s) {
        if (!is_array($s)) continue;
        $key = (string)($s['k'] ?? '');
        if (preg_match('/^up:(\d+)$/', $key, $m)) {
            if (!own_upload($uid, (int)$m[1], 'sticker')) continue;
        } elseif (!in_array($key, STICKERS, true)) {
            continue;
        }
        $out['stickers'][] = [
            'k' => $key,
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
    $row = q('SELECT id, kind, file FROM uploads WHERE id = ? AND user_id = ?', [$id, $uid])->fetch();
    if (!$row || ($kind !== null && $row['kind'] !== $kind)) return null;
    return $row;
}

function upload_url(?int $id): string
{
    if (!$id) return '';
    $row = q('SELECT file FROM uploads WHERE id = ?', [$id])->fetch();
    return $row ? 'uploads/' . $row['file'] : '';
}

function delete_upload(int $uid, ?int $id): void
{
    if (!$id) return;
    $row = own_upload($uid, $id);
    if (!$row) return;
    q('DELETE FROM uploads WHERE id = ?', [$id]);
    $path = __DIR__ . '/uploads/' . $row['file'];
    if (is_file($path)) @unlink($path);
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

/** The profile row of a user; created (private, nothing shared) the first time it's needed. */
function ensure_profile(int $uid): array
{
    $row = q('SELECT * FROM profiles WHERE user_id = ?', [$uid])->fetch();
    if (!$row) {
        $name = (string)(q('SELECT name FROM users WHERE id = ?', [$uid])->fetch()['name'] ?? 'user');
        q('INSERT INTO profiles (user_id, slug, bio, share, design, notify) VALUES (?, ?, ?, ?, ?, ?)', [
            $uid, make_slug($name), '',
            json_encode(['blog' => 1, 'interests' => 1, 'timetable' => 0, 'subjects' => 0]),
            json_encode(default_design()),
            json_encode(['follow' => 1, 'like' => 1, 'dm' => 1]),
        ]);
        $row = q('SELECT * FROM profiles WHERE user_id = ?', [$uid])->fetch();
    }
    return $row;
}

function profile_share(array $row): array
{
    return json_col($row['share'] ?? null, ['blog' => 1, 'interests' => 1, 'timetable' => 0, 'subjects' => 0]);
}

function profile_design(array $row): array
{
    return json_col($row['design'] ?? null, default_design());
}

/** May this viewer (a user id, or null for a visitor who isn't logged in) open this notebook? */
function can_view_profile(array $row, ?int $viewer): bool
{
    if ($viewer !== null && $viewer === (int)$row['user_id']) return true;
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

function wants_notice(int $uid, string $type): bool
{
    $row = ensure_profile($uid);
    $n = json_col($row['notify'] ?? null, ['follow' => 1, 'like' => 1, 'dm' => 1]);
    return !empty($n[$type]);
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

/** Check, shrink and store an uploaded picture. Returns the new uploads id. */
function save_image(int $uid, array $file, string $kind): int
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE ? 'That picture is too big (6 MB at most).' : 'The picture did not upload. Try again.');
    }
    if ($file['size'] > 6 * 1024 * 1024) throw new RuntimeException('That picture is too big (6 MB at most).');
    if ((int)q('SELECT COUNT(*) c FROM uploads WHERE user_id = ?', [$uid])->fetch()['c'] >= 250) {
        throw new RuntimeException('You have reached the limit of 250 pictures. Delete some first.');
    }
    $info = @getimagesize($file['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) throw new RuntimeException('Please choose a JPG, PNG, GIF or WebP picture.');
    if ($info[0] * $info[1] > 40_000_000) throw new RuntimeException('That picture is too large in pixels.');

    $max = ['photo' => 1600, 'cover' => 2000, 'sticker' => 400][$kind] ?? 1600;
    $dir = __DIR__ . '/uploads/u' . $uid;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) throw new RuntimeException('The site cannot save pictures (the uploads folder is not writable).');
    $ext = $types[$info[2]];
    $name = 'u' . $uid . '/' . bin2hex(random_bytes(12));

    $done = false;
    if (function_exists('imagecreatefromstring') && $info[2] !== IMAGETYPE_GIF) {
        // Re-draw the picture: this shrinks it and drops hidden data (camera location etc.)
        $src = @imagecreatefromstring((string)file_get_contents($file['tmp_name']));
        if ($src) {
            if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
                $exif = @exif_read_data($file['tmp_name']);
                $o = (int)($exif['Orientation'] ?? 1);
                $rot = [3 => 180, 6 => -90, 8 => 90][$o] ?? 0;
                if ($rot) { $r = imagerotate($src, $rot, 0); if ($r) $src = $r; }
            }
            $w = imagesx($src); $h = imagesy($src);
            $scale = min(1, $max / max($w, $h));
            $nw = max(1, (int)round($w * $scale)); $nh = max(1, (int)round($h * $scale));
            $dst = imagecreatetruecolor($nw, $nh);
            $keepAlpha = $info[2] === IMAGETYPE_PNG || $info[2] === IMAGETYPE_WEBP;
            if ($keepAlpha) {
                imagealphablending($dst, false); imagesavealpha($dst, true);
                imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 0, 0, 0, 127));
            }
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
            $path = $dir . '/' . basename($name) . '.' . ($keepAlpha ? 'png' : 'jpg');
            $ok = $keepAlpha ? imagepng($dst, $path, 6) : imagejpeg($dst, $path, 86);
            if ($ok) { $ext = $keepAlpha ? 'png' : 'jpg'; $done = true; }
        }
    }
    if (!$done) {
        $path = $dir . '/' . basename($name) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $path)) throw new RuntimeException('The picture could not be saved.');
    }
    q('INSERT INTO uploads (user_id, kind, file) VALUES (?, ?, ?)', [$uid, $kind, $name . '.' . $ext]);
    return (int)db()->lastInsertId();
}


// ---------- messages ----------

/** Do both people follow each other? Only then can they message. */
function is_mutual(int $a, int $b): bool
{
    return (int)q('SELECT COUNT(*) c FROM follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)', [$a, $b, $b, $a])->fetch()['c'] === 2;
}

function msg_unread(int $uid): int
{
    try {
        return (int)q('SELECT COUNT(*) c FROM messages WHERE recipient_id = ? AND is_read = 0', [$uid])->fetch()['c'];
    } catch (PDOException $e) {
        return 0;
    }
}

/** Everyone you can talk to (mutual followers) plus anyone you already talked to, newest conversation first. */
function msg_threads(int $uid): array
{
    $ids = [];
    foreach (q('SELECT f1.followee_id id FROM follows f1 JOIN follows f2 ON f2.follower_id = f1.followee_id AND f2.followee_id = f1.follower_id WHERE f1.follower_id = ?', [$uid])->fetchAll() as $r) $ids[(int)$r['id']] = true;
    foreach (q('SELECT DISTINCT CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END id FROM messages WHERE sender_id = ? OR recipient_id = ?', [$uid, $uid, $uid])->fetchAll() as $r) $ids[(int)$r['id']] = true;
    $out = [];
    foreach (array_slice(array_keys($ids), 0, 200) as $id) {
        $u = q('SELECT u.name, p.slug, p.is_public FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?', [$id])->fetch();
        if (!$u) continue;
        $last = q('SELECT id, sender_id, body, created_at FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ORDER BY id DESC LIMIT 1', [$uid, $id, $id, $uid])->fetch();
        $unread = (int)q('SELECT COUNT(*) c FROM messages WHERE sender_id = ? AND recipient_id = ? AND is_read = 0', [$id, $uid])->fetch()['c'];
        $out[] = ['id' => $id, 'name' => $u['name'], 'slug' => (int)($u['is_public'] ?? 0) ? $u['slug'] : '', 'can' => is_mutual($uid, $id),
            'last' => $last ? ($last['sender_id'] == $uid ? 'You: ' : '') . mb_substr($last['body'], 0, 70) : '', 'last_id' => (int)($last['id'] ?? 0),
            'at' => (string)($last['created_at'] ?? ''), 'unread' => $unread];
    }
    usort($out, fn($a, $b) => [$b['last_id'], $a['name']] <=> [$a['last_id'], $b['name']]);
    return $out;
}

function msg_rows(int $uid, int $with, int $after = 0): array
{
    $rows = $after > 0
        ? q('SELECT id, sender_id, body, created_at FROM messages WHERE id > ? AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)) ORDER BY id', [$after, $uid, $with, $with, $uid])->fetchAll()
        : array_reverse(q('SELECT id, sender_id, body, created_at FROM messages WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) ORDER BY id DESC LIMIT 100', [$uid, $with, $with, $uid])->fetchAll());
    return array_map(fn($m) => ['id' => (int)$m['id'], 'mine' => (int)$m['sender_id'] === $uid, 'body' => $m['body'], 'at' => (string)$m['created_at']], $rows);
}

// ---------- loading ----------

function post_row(array $p, int $likes, bool $liked = false): array
{
    return [
        'id' => (int)$p['id'], 'title' => $p['title'], 'body' => $p['body'],
        'image' => upload_url($p['image_id'] ? (int)$p['image_id'] : null), 'image_id' => (int)($p['image_id'] ?? 0),
        'public' => (int)$p['is_public'] === 1, 'date' => substr((string)$p['created_at'], 0, 10),
        'likes' => $likes, 'liked' => $liked,
    ];
}

function load_posts(int $owner, bool $onlyPublic, ?int $viewer): array
{
    $sql = 'SELECT p.*, (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes FROM posts p WHERE p.user_id = ?'
        . ($onlyPublic ? ' AND p.is_public = 1' : '') . ' ORDER BY p.created_at DESC, p.id DESC';
    $out = [];
    foreach (q($sql, [$owner])->fetchAll() as $p) {
        $liked = $viewer !== null && (bool)q('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?', [$p['id'], $viewer])->fetch();
        $out[] = post_row($p, (int)$p['likes'], $liked);
    }
    return $out;
}

function load_lists(int $owner, bool $onlyPublic): array
{
    $lists = q('SELECT * FROM interest_lists WHERE user_id = ?' . ($onlyPublic ? ' AND is_public = 1' : '') . ' ORDER BY id', [$owner])->fetchAll();
    $out = [];
    foreach ($lists as $l) {
        $items = [];
        foreach (q('SELECT * FROM interest_items WHERE list_id = ? ORDER BY id', [$l['id']])->fetchAll() as $it) {
            $items[] = ['id' => (int)$it['id'], 'text' => $it['text'], 'note' => $it['note'],
                'image' => upload_url($it['image_id'] ? (int)$it['image_id'] : null), 'image_id' => (int)($it['image_id'] ?? 0)];
        }
        $out[] = ['id' => (int)$l['id'], 'title' => $l['title'], 'emoji' => $l['emoji'], 'layout' => $l['layout'],
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

function social_bootstrap(int $uid): array
{
    $p = ensure_profile($uid);
    $notify = json_col($p['notify'] ?? null, ['follow' => 1, 'like' => 1, 'dm' => 1]);
    $followers = (int)q('SELECT COUNT(*) c FROM follows WHERE followee_id = ?', [$uid])->fetch()['c'];
    $design = profile_design($p);
    return [
        'profile' => ['slug' => $p['slug'], 'bio' => $p['bio'], 'public' => (int)$p['is_public'] === 1, 'guest' => (int)$p['guest_view'] === 1,
            'share' => profile_share($p), 'notify' => $notify, 'followers' => $followers],
        'design' => $design,
        'cover_url' => upload_url($design['cover_img'] ? (int)$design['cover_img'] : null),
        'stickers_up' => array_map(fn($r) => ['id' => (int)$r['id'], 'url' => 'uploads/' . $r['file']],
            q("SELECT id, file FROM uploads WHERE user_id = ? AND kind = 'sticker' ORDER BY id DESC LIMIT 40", [$uid])->fetchAll()),
        'posts' => load_posts($uid, false, $uid),
        'lists' => load_lists($uid, false),
        'notes' => load_notifications($uid),
        'unread' => unread_count($uid),
        'msg_unread' => msg_unread($uid),
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

function social_action(int $uid, string $action, array $in): void
{
    switch ($action) {
    case 'x.load':
        ok(social_bootstrap($uid));

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
        if (isset($in['share']) && is_array($in['share'])) {
            $share = profile_share($p);
            foreach (SHARE_KEYS as $k) if (array_key_exists($k, $in['share'])) $share[$k] = !empty($in['share'][$k]) ? 1 : 0;
            q('UPDATE profiles SET share = ? WHERE user_id = ?', [json_encode($share), $uid]);
        }
        if (isset($in['notify']) && is_array($in['notify'])) {
            $n = json_col($p['notify'] ?? null, ['follow' => 1, 'like' => 1, 'dm' => 1]);
            foreach (NOTIFY_KEYS as $k) if (array_key_exists($k, $in['notify'])) $n[$k] = !empty($in['notify'][$k]) ? 1 : 0;
            q('UPDATE profiles SET notify = ? WHERE user_id = ?', [json_encode($n), $uid]);
        }
        ok();
    }

    case 'x.design.save': {
        ensure_profile($uid);
        $d = clean_design($uid, (array)($in['design'] ?? []));
        q('UPDATE profiles SET design = ? WHERE user_id = ?', [json_encode($d), $uid]);
        ok(['design' => $d, 'cover_url' => upload_url($d['cover_img'] ? (int)$d['cover_img'] : null)]);
    }

    case 'x.upload.delete': {
        $id = id_in($in);
        $row = own_upload($uid, $id);
        if (!$row) fail(404, 'Picture not found.');
        // pictures that are still used somewhere stay; this is for stickers and covers you no longer want
        $p = ensure_profile($uid);
        $design = profile_design($p);
        if ((int)$design['cover_img'] === $id) $design['cover_img'] = 0;
        $design['stickers'] = array_values(array_filter($design['stickers'], fn($s) => $s['k'] !== 'up:' . $id));
        q('UPDATE profiles SET design = ? WHERE user_id = ?', [json_encode($design), $uid]);
        q('UPDATE posts SET image_id = NULL WHERE image_id = ? AND user_id = ?', [$id, $uid]);
        q('UPDATE interest_items SET image_id = NULL WHERE image_id = ? AND list_id IN (SELECT id FROM interest_lists WHERE user_id = ?)', [$id, $uid]);
        delete_upload($uid, $id);
        ok(['design' => $design]);
    }

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
        q('INSERT INTO posts (user_id, title, body, image_id, is_public) VALUES (?, ?, ?, ?, ?)', [$uid, $title, $body, $img, $public]);
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
        $title = str_in($in, 'title', 80);
        $emoji = in_array($in['emoji'] ?? '', LIST_EMOJI, true) ? $in['emoji'] : '';
        $layout = ($in['layout'] ?? '') === 'grid' ? 'grid' : 'list';
        if ((int)q('SELECT COUNT(*) c FROM interest_lists WHERE user_id = ?', [$uid])->fetch()['c'] >= 40) fail(400, 'That is plenty of lists! Delete one first.');
        q('INSERT INTO interest_lists (user_id, title, emoji, layout, is_public) VALUES (?, ?, ?, ?, ?)', [$uid, $title, $emoji, $layout, !empty($in['public']) ? 1 : 0]);
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

    case 'x.follow': {
        $to = id_in($in, 'user_id');
        if ($to === $uid) fail(400, 'You cannot follow yourself.');
        $prof = q('SELECT * FROM profiles WHERE user_id = ?', [$to])->fetch();
        if (!$prof || !can_view_profile($prof, $uid)) fail(404, 'That notebook is private.');
        $have = q('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?', [$uid, $to])->fetch();
        if ($have) {
            q('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?', [$uid, $to]);
        } else {
            q('INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)', [$uid, $to]);
            if (wants_notice($to, 'follow')) {
                $me = ensure_profile($uid);
                $name = (string)q('SELECT name FROM users WHERE id = ?', [$uid])->fetch()['name'];
                $mine = (int)$me['is_public'] === 1;
                notify($to, 'follow:' . $uid, "$name started following you.", $mine ? 'u.php?u=' . $me['slug'] : '');
            }
        }
        ok(['following' => !$have, 'followers' => (int)q('SELECT COUNT(*) c FROM follows WHERE followee_id = ?', [$to])->fetch()['c']]);
    }

    case 'x.like': {
        $pid = id_in($in, 'post_id');
        $post = q('SELECT * FROM posts WHERE id = ?', [$pid])->fetch();
        if (!$post) fail(404, 'That post was not found.');
        $owner = (int)$post['user_id'];
        $prof = ensure_profile($owner);
        $share = profile_share($prof);
        if ($owner !== $uid && (!can_view_profile($prof, $uid) || !(int)$post['is_public'] || empty($share['blog']))) fail(404, 'That post is private.');
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


    case 'x.msg.threads':
        ok(['threads' => msg_threads($uid), 'unread' => msg_unread($uid)]);

    case 'x.msg.load': {
        $with = id_in($in, 'with');
        if (!q('SELECT 1 FROM users WHERE id = ?', [$with])->fetch()) fail(404, 'That person was not found.');
        $rows = msg_rows($uid, $with, (int)($in['after'] ?? 0));
        q('UPDATE messages SET is_read = 1 WHERE recipient_id = ? AND sender_id = ? AND is_read = 0', [$uid, $with]);
        ok(['messages' => $rows, 'can' => is_mutual($uid, $with), 'unread' => msg_unread($uid)]);
    }

    case 'x.msg.send': {
        $to = id_in($in, 'to');
        $body = mb_substr(trim((string)($in['body'] ?? '')), 0, 2000);
        if ($body === '') fail(400, 'Write a message first.');
        if ($to === $uid) fail(400, 'You cannot message yourself.');
        if (!is_mutual($uid, $to)) fail(403, 'You can only message people who follow you back.');
        if (!wants_notice($to, 'dm')) fail(403, 'This person is not taking messages right now.');
        $recent = (int)q('SELECT COUNT(*) c FROM messages WHERE sender_id = ? AND created_at > ?', [$uid, date('Y-m-d H:i:s', time() - 60)])->fetch()['c'];
        if ($recent >= 30) fail(429, 'Slow down a little, then try again.');
        q('INSERT INTO messages (sender_id, recipient_id, body, created_at) VALUES (?, ?, ?, ?)', [$uid, $to, $body, date('Y-m-d H:i:s')]);
        $id = (int)db()->lastInsertId();
        ok(['message' => ['id' => $id, 'mine' => true, 'body' => $body, 'at' => (string)q('SELECT created_at FROM messages WHERE id = ?', [$id])->fetch()['created_at']]]);
    }

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
