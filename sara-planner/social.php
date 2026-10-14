<?php
// Shared helpers for people, profiles and friends (people.php, profile.php, friend.php, chat).
declare(strict_types=1);

// Notebook covers: [name, style]. 'label' covers have a name label with your picture, 'spiral' ones show your cover words in script.
// The drawings are plain CSS in assets/covers.css. Old cover names (from earlier versions) are mapped to the closest new one.
const COVERS = [
    'daisy' => ['Daisy meadow', 'label'], 'gingham' => ['Cherry gingham', 'label'], 'cream' => ['Cream & gold', 'label'],
    'sage' => ['Sage linen', 'label'], 'midnight' => ['Midnight stars', 'label'], 'mocha' => ['Mocha corduroy', 'label'],
    'marble' => ['Pink marble', 'spiral'], 'lavender' => ['Lavender', 'spiral'], 'sunset' => ['Retro sunset', 'spiral'],
    'butter' => ['Butter dots', 'spiral'], 'cloud' => ['Soft clouds', 'spiral'], 'matcha' => ['Matcha waves', 'spiral'],
];
const COVER_LEGACY = ['meadow' => 'daisy', 'cherry' => 'gingham', 'autumn' => 'mocha', 'woodland' => 'sage', 'cocoa' => 'mocha',
    'rose' => 'cream', 'blush' => 'marble', 'petal' => 'marble', 'rosewood' => 'sunset', 'ivory' => 'cloud', 'nude' => 'butter'];
const DEFAULT_COVER = 'daisy';

/** A saved cover name as a current one (old names are mapped, unknown ones fall back to the default). */
function resolve_cover(string $c): string
{
    $c = COVER_LEGACY[$c] ?? $c;
    return isset(COVERS[$c]) ? $c : DEFAULT_COVER;
}
// Hour types and the colour each one has in the planner (same as HT in assets/app.js)
const HOUR_COLORS = ['uni' => 'school', 'work' => 'transport', 'study' => 'food', 'personal' => 'fun',
    'health' => 'groceries', 'sleep' => 'other'];
const HOUR_NAMES = ['uni' => 'Uni', 'work' => 'Work', 'study' => 'Study', 'personal' => 'Personal',
    'health' => 'Health', 'sleep' => 'Sleep'];

/** Name, bio, cover and picture version of one user, or null if the account doesn't exist. */
function person(int $id): ?array
{
    $u = q('SELECT id, name, email FROM users WHERE id = ?', [$id])->fetch();
    if (!$u) return null;
    try {
        $p = q('SELECT bio, cover, words, avatar_v FROM profiles WHERE user_id = ?', [$id])->fetch();
    } catch (PDOException $e) {   // words column couldn't be added on this host
        $p = q("SELECT bio, cover, '' AS words, avatar_v FROM profiles WHERE user_id = ?", [$id])->fetch();
    }
    $p = $p ?: ['bio' => '', 'cover' => DEFAULT_COVER, 'words' => '', 'avatar_v' => 0];
    return ['id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'], 'bio' => $p['bio'],
        'cover' => resolve_cover((string)$p['cover']), 'words' => (string)$p['words'], 'avatar_v' => (int)$p['avatar_v'],
        'same_name' => same_name_count($u['name']) > 1];
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
    $cover = resolve_cover($cover ?? $p['cover']);
    $style = COVERS[$cover][1];
    $cls = 'nbc cv-' . $cover . ($style === 'spiral' ? ' spiral' : '') . ($mini ? ' mini' : '');
    $out = '<span class="' . $cls . '" aria-hidden="true"><span class="nbc-art"></span><span class="nbc-spine"></span>';
    if (!$mini) {
        if ($style === 'spiral') {
            $words = trim($p['words']);
            $out .= '<span class="nbc-words"><span class="nbc-script" translate="no">' . h($words !== '' ? $words : $p['name']) . '</span>'
                . avatar_html($p) . '<span class="nbc-small" translate="no">' . ($words !== '' ? h($p['name']) : '') . '</span></span>';
        } else {
            $out .= '<span class="nbc-label">' . avatar_html($p) . '<span class="nbc-name" translate="no">' . h($p['name']) . '</span>'
                . '<span class="nbc-orn"></span></span>';
        }
    }
    return $out . '</span>';
}

/** Name, plus the email underneath when someone else has the same name. */
function name_html(array $p): string
{
    return '<span class="pname">' . h($p['name']) . '</span>'
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
