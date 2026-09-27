<?php
// JSON API used by assets/app.js. Every request is POST api.php?action=...
// Every query is limited to the logged-in user's own data.
declare(strict_types=1);

require __DIR__ . '/db.php';
require __DIR__ . '/gcal.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $status, string $msg): never
{
    http_response_code($status);
    echo json_encode(['error' => $msg]);
    exit;
}

function ok(array $data = []): never
{
    echo json_encode(['ok' => true] + $data);
    exit;
}

function str_in(array $in, string $key, int $max, bool $required = true): string
{
    $v = trim((string)($in[$key] ?? ''));
    if ($required && $v === '') fail(400, "Please fill in the $key.");
    return mb_substr($v, 0, $max);
}

function date_in(array $in, string $key, bool $required = true): ?string
{
    $v = (string)($in[$key] ?? '');
    if ($v === '' && !$required) return null;
    $d = DateTime::createFromFormat('!Y-m-d', $v);
    if (!$d || $d->format('Y-m-d') !== $v) fail(400, 'That date is not valid.');
    return $v;
}

function int_in(array $in, string $key, int $min, int $max): int
{
    if (!isset($in[$key]) || !is_numeric($in[$key])) fail(400, "Missing $key.");
    $v = (int)$in[$key];
    if ($v < $min || $v > $max) fail(400, "$key is out of range.");
    return $v;
}

/** A time like "08:45" as minutes since midnight. 24:00 is allowed as an end time. */
function time_in(array $in, string $key): int
{
    $v = (string)($in[$key] ?? '');
    if (is_numeric($v)) return int_in([$key => (int)$v * 60], $key, 0, 1440); // old pages send whole hours
    if (!preg_match('/^(\d{1,2}):(\d{2})$/', $v, $m)) fail(400, 'That time is not valid.');
    $t = (int)$m[1] * 60 + (int)$m[2];
    if ((int)$m[2] > 59 || $t > 1440) fail(400, 'That time is not valid.');
    return $t;
}

function id_in(array $in, string $key = 'id'): int
{
    return int_in($in, $key, 1, PHP_INT_MAX);
}

function weekday_of(string $date): int
{
    return ((int)date('N', strtotime($date))) - 1; // 0 = Monday
}

const CATEGORIES  = ['Food', 'Coffee', 'Transport', 'Groceries', 'School', 'Phone', 'Fun', 'Other'];
const PRIORITIES  = ['high', 'med', 'low'];
const HOUR_TYPES  = ['uni', 'work', 'study', 'personal', 'health', 'sleep'];
const SUBJ_COLORS = ['school', 'fun', 'transport', 'food', 'groceries', 'coffee', 'phone', 'other'];

// ---------- checks every request goes through ----------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Use POST.');
$uid = current_user_id();
if (!$uid) fail(401, 'Please log in again.');
if (!check_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) fail(403, 'Your session expired. Reload the page.');
if (!is_verified($uid)) fail(403, 'Confirm your email first. Reload the page.');

$in = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($in)) $in = [];
$action = (string)($_GET['action'] ?? '');

// ---------- hour helpers (a day's own entry wins over the weekly one) ----------
function day_hour(int $uid, string $date, int $h): ?array
{
    return q('SELECT text, type, start_min, end_min FROM hours WHERE user_id = ? AND date = ? AND hour = ?', [$uid, $date, $h])->fetch() ?: null;
}

function week_hour(int $uid, int $wd, int $h): ?array
{
    return q('SELECT text, type, start_min, end_min FROM weekly_hours WHERE user_id = ? AND weekday = ? AND hour = ?', [$uid, $wd, $h])->fetch() ?: null;
}

// start_min / end_min: the part of the hour that is used (0 and 60 = the whole hour)
function put_day_hour(int $uid, string $date, int $h, string $text, string $type, int $s = 0, int $e = 60): void
{
    q('DELETE FROM hours WHERE user_id = ? AND date = ? AND hour = ?', [$uid, $date, $h]);
    q('INSERT INTO hours (user_id, date, hour, text, type, start_min, end_min) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$uid, $date, $h, $text, $type, $s, $e]);
}

function put_week_hour(int $uid, int $wd, int $h, string $text, string $type, int $s = 0, int $e = 60): void
{
    q('DELETE FROM weekly_hours WHERE user_id = ? AND weekday = ? AND hour = ?', [$uid, $wd, $h]);
    q('INSERT INTO weekly_hours (user_id, weekday, hour, text, type, start_min, end_min) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$uid, $wd, $h, $text, $type, $s, $e]);
}

/** One hour as the page wants it: minutes are only sent when they aren't the whole hour. */
function hour_out(array $r): array
{
    $o = ['text' => $r['text'], 'type' => $r['type']];
    if ((int)$r['start_min'] !== 0) $o['s'] = (int)$r['start_min'];
    if ((int)$r['end_min'] !== 60)  $o['e'] = (int)$r['end_min'];
    return $o;
}

/** Make sure a chapter/topic/subject id belongs to this user. */
function own_subject(int $uid, int $id): void
{
    if (!q('SELECT 1 FROM subjects WHERE id = ? AND user_id = ?', [$id, $uid])->fetch()) fail(404, 'Subject not found.');
}

function own_chapter(int $uid, int $id): void
{
    $sql = 'SELECT 1 FROM chapters c JOIN subjects s ON s.id = c.subject_id WHERE c.id = ? AND s.user_id = ?';
    if (!q($sql, [$id, $uid])->fetch()) fail(404, 'Chapter not found.');
}

function own_topic(int $uid, int $id): void
{
    $sql = 'SELECT 1 FROM topics t JOIN chapters c ON c.id = t.chapter_id JOIN subjects s ON s.id = c.subject_id
            WHERE t.id = ? AND s.user_id = ?';
    if (!q($sql, [$id, $uid])->fetch()) fail(404, 'Topic not found.');
}

// ---------- everything the page needs on load ----------
function bootstrap(int $uid): array
{
    $user = q('SELECT name FROM users WHERE id = ?', [$uid])->fetch();
    $set  = q('SELECT income, goal, note FROM settings WHERE user_id = ?', [$uid])->fetch()
         ?: ['income' => 0, 'goal' => 0, 'note' => ''];

    $exps = array_map(fn($r) => [
        'id' => (string)$r['id'], 'date' => $r['date'], 'desc' => $r['description'],
        'cat' => $r['category'], 'amount' => (float)$r['amount'],
    ], q('SELECT id, date, description, category, amount FROM expenses WHERE user_id = ? ORDER BY date, id', [$uid])->fetchAll());

    $tasks = array_map(fn($r) => [
        'id' => (string)$r['id'], 'title' => $r['title'], 'due' => $r['due'],
        'priority' => $r['priority'], 'tag' => $r['tag'], 'done' => (bool)$r['done'],
    ], q('SELECT id, title, due, priority, tag, done FROM tasks WHERE user_id = ? ORDER BY due, id', [$uid])->fetchAll());

    // Objects, not arrays, so JSON keeps the hour numbers as keys
    $hours = new stdClass();
    foreach (q('SELECT date, hour, text, type, start_min, end_min FROM hours WHERE user_id = ?', [$uid]) as $r) {
        $d = $r['date'];
        if (!isset($hours->$d)) $hours->$d = new stdClass();
        $hours->$d->{$r['hour']} = hour_out($r);
    }
    $weekly = [];
    for ($i = 0; $i < 7; $i++) $weekly[$i] = new stdClass();
    foreach (q('SELECT weekday, hour, text, type, start_min, end_min FROM weekly_hours WHERE user_id = ?', [$uid]) as $r) {
        $weekly[(int)$r['weekday']]->{$r['hour']} = hour_out($r);
    }

    $blockDone = new stdClass();
    foreach (q('SELECT block_key FROM block_done WHERE user_id = ?', [$uid]) as $r) {
        $blockDone->{$r['block_key']} = true;
    }

    $study = array_fill(0, 7, ['subject' => '', 'topic' => '', 'h' => 0, 'rev' => false, 'p' => 1]);
    foreach (q('SELECT weekday, subject, topic, hours, revised, priority FROM study_plan WHERE user_id = ?', [$uid]) as $r) {
        $study[(int)$r['weekday']] = [
            'subject' => $r['subject'], 'topic' => $r['topic'], 'h' => (float)$r['hours'],
            'rev' => (bool)$r['revised'], 'p' => (int)$r['priority'],
        ];
    }

    $upcoming = array_map(fn($r) => ['id' => (string)$r['id'], 't' => $r['title'], 'date' => $r['date']],
        q('SELECT id, title, date FROM upcoming WHERE user_id = ? ORDER BY date, id', [$uid])->fetchAll());

    $subjects = [];
    foreach (q('SELECT id, name, color, exam FROM subjects WHERE user_id = ? ORDER BY id', [$uid]) as $s) {
        $subjects[(int)$s['id']] = [
            'id' => (string)$s['id'], 'name' => $s['name'], 'c' => $s['color'],
            'exam' => $s['exam'] ?? '', 'chapters' => [],
        ];
    }
    $chapters = [];
    $sql = 'SELECT c.id, c.subject_id, c.title, c.done, c.source FROM chapters c JOIN subjects s ON s.id = c.subject_id
            WHERE s.user_id = ? ORDER BY c.id';
    try {
        $rows = q($sql, [$uid])->fetchAll();
    } catch (PDOException $e) {
        // Database without the source column yet: load chapters without it
        $rows = q(str_replace(', c.source', '', $sql), [$uid])->fetchAll();
    }
    foreach ($rows as $c) {
        $chapters[(int)$c['id']] = ['sid' => (int)$c['subject_id'], 'id' => (string)$c['id'],
            'title' => $c['title'], 'done' => (bool)$c['done'], 'src' => $c['source'] ?? '', 'topics' => []];
    }
    $sql = 'SELECT t.id, t.chapter_id, t.title, t.done FROM topics t JOIN chapters c ON c.id = t.chapter_id
            JOIN subjects s ON s.id = c.subject_id WHERE s.user_id = ? ORDER BY t.id';
    foreach (q($sql, [$uid]) as $t) {
        $cid = (int)$t['chapter_id'];
        if (isset($chapters[$cid])) {
            $chapters[$cid]['topics'][] = ['id' => (string)$t['id'], 't' => $t['title'], 'done' => (bool)$t['done']];
        }
    }
    foreach ($chapters as $c) {
        $sid = $c['sid'];
        unset($c['sid']);
        if (isset($subjects[$sid])) $subjects[$sid]['chapters'][] = $c;
    }

    // Per-month changes, keyed "year-month" (month 0 = January)
    $months = new stdClass();
    foreach (q('SELECT year, month, income, save_target FROM month_money WHERE user_id = ?', [$uid]) as $r) {
        $months->{$r['year'] . '-' . $r['month']} = [
            'income' => $r['income'] === null ? null : (float)$r['income'],
            'save'   => $r['save_target'] === null ? null : (float)$r['save_target'],
        ];
    }

    return [
        'user'      => ['name' => $user['name'] ?? ''],
        'settings'  => ['income' => (float)$set['income'], 'goal' => (float)$set['goal']],
        'months'    => $months,
        'note'      => $set['note'],
        'exps'      => $exps,
        'tasks'     => $tasks,
        'hours'     => $hours,
        'weekly'    => $weekly,
        'blockDone' => $blockDone,
        'study'     => $study,
        'upcoming'  => $upcoming,
        'subjects'  => array_values($subjects),
        'google'    => google_status($uid),
    ];
}

/** Is Google Calendar set up on this site, connected for this user, and does the next two weeks still need sending? */
function google_status(int $uid): array
{
    $acc = gcal_configured() ? gcal_account($uid) : null;
    return [
        'configured' => gcal_configured(),
        'connected'  => (bool)$acc,
        'email'      => $acc['google_email'] ?? '',
        'needsSync'  => $acc && $acc['synced_on'] !== date('Y-m-d'),
    ];
}

// ---------- actions ----------
try {
    switch ($action) {
    case 'bootstrap':
        echo json_encode(bootstrap($uid));
        exit;

    case 'settings.save':
        if (!q('SELECT 1 FROM settings WHERE user_id = ?', [$uid])->fetch()) {
            q('INSERT INTO settings (user_id, income, goal, note) VALUES (?, 0, 0, ?)', [$uid, '']);
        }
        foreach (['income', 'goal'] as $k) {
            if (array_key_exists($k, $in)) {
                $v = (float)$in[$k];
                if ($v < 0 || $v > 99999999) fail(400, 'That amount is not valid.');
                q("UPDATE settings SET $k = ? WHERE user_id = ?", [round($v, 2), $uid]);
            }
        }
        if (array_key_exists('note', $in)) {
            q('UPDATE settings SET note = ? WHERE user_id = ?', [mb_substr((string)$in['note'], 0, 500), $uid]);
        }
        ok();

    case 'month.save': {
        // Change one month's income or savings target. An empty value (null) goes back to the normal one.
        $year  = int_in($in, 'year', 2000, 2100);
        $month = int_in($in, 'month', 0, 11);
        $cols  = ['income' => 'income', 'save' => 'save_target'];
        if (!q('SELECT 1 FROM month_money WHERE user_id = ? AND year = ? AND month = ?', [$uid, $year, $month])->fetch()) {
            q('INSERT INTO month_money (user_id, year, month) VALUES (?, ?, ?)', [$uid, $year, $month]);
        }
        foreach ($cols as $k => $col) {
            if (!array_key_exists($k, $in)) continue;
            $v = $in[$k];
            if ($v !== null) {
                if (!is_numeric($v) || (float)$v < 0 || (float)$v > 99999999) fail(400, 'That amount is not valid.');
                $v = round((float)$v, 2);
            }
            q("UPDATE month_money SET $col = ? WHERE user_id = ? AND year = ? AND month = ?", [$v, $uid, $year, $month]);
        }
        q('DELETE FROM month_money WHERE user_id = ? AND year = ? AND month = ? AND income IS NULL AND save_target IS NULL',
            [$uid, $year, $month]);
        ok();
    }

    case 'expense.add':
        $amount = round((float)($in['amount'] ?? 0), 2);
        if ($amount <= 0 || $amount > 99999999) fail(400, 'Enter an amount above zero.');
        $cat = in_array($in['cat'] ?? '', CATEGORIES, true) ? $in['cat'] : 'Other';
        q('INSERT INTO expenses (user_id, date, description, category, amount) VALUES (?, ?, ?, ?, ?)',
            [$uid, date_in($in, 'date'), str_in($in, 'desc', 200), $cat, $amount]);
        ok(['id' => db()->lastInsertId()]);

    case 'expense.delete':
        q('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id_in($in), $uid]);
        ok();

    case 'task.add':
        $prio = in_array($in['priority'] ?? '', PRIORITIES, true) ? $in['priority'] : 'med';
        q('INSERT INTO tasks (user_id, title, due, priority, tag) VALUES (?, ?, ?, ?, ?)',
            [$uid, str_in($in, 'title', 200), date_in($in, 'due'), $prio, str_in($in, 'tag', 40, false)]);
        ok(['id' => db()->lastInsertId()]);

    case 'task.toggle':
        q('UPDATE tasks SET done = ? WHERE id = ? AND user_id = ?', [empty($in['done']) ? 0 : 1, id_in($in), $uid]);
        ok();

    case 'task.delete':
        q('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id_in($in), $uid]);
        ok();

    case 'hour.save': {
        $date = date_in($in, 'date');
        $h    = int_in($in, 'hour', 0, 23);
        $wd   = weekday_of($date);
        $day  = day_hour($uid, $date, $h);
        $week = $day ? null : week_hour($uid, $wd, $h);
        $cur  = $day ?? $week ?? ['text' => '', 'type' => 'personal', 'start_min' => 0, 'end_min' => 60];

        if (array_key_exists('type', $in)) {
            $cur['type'] = in_array($in['type'], HOUR_TYPES, true) ? $in['type'] : 'personal';
        }
        if (array_key_exists('s', $in)) $cur['start_min'] = int_in($in, 's', 0, 59);
        if (array_key_exists('e', $in)) $cur['end_min']   = int_in($in, 'e', 1, 60);
        if ((int)$cur['end_min'] <= (int)$cur['start_min']) fail(400, 'The end time has to be after the start time.');
        $clear = false;
        if (array_key_exists('text', $in)) {
            $cur['text'] = mb_substr((string)$in['text'], 0, 200);
            $clear = trim($cur['text']) === '';
        }

        // Same rule as the page: edit the entry that is showing (this day's, else the weekly one)
        if ($week) {
            if ($clear) q('DELETE FROM weekly_hours WHERE user_id = ? AND weekday = ? AND hour = ?', [$uid, $wd, $h]);
            else put_week_hour($uid, $wd, $h, $cur['text'], $cur['type'], (int)$cur['start_min'], (int)$cur['end_min']);
        } else {
            if ($clear) q('DELETE FROM hours WHERE user_id = ? AND date = ? AND hour = ?', [$uid, $date, $h]);
            else put_day_hour($uid, $date, $h, $cur['text'], $cur['type'], (int)$cur['start_min'], (int)$cur['end_min']);
        }
        ok();
    }

    case 'hour.repeat': {
        // Move an hour between "this day only" and "every week"
        $date = date_in($in, 'date');
        $h    = int_in($in, 'hour', 0, 23);
        $wd   = weekday_of($date);
        db()->beginTransaction();
        if ($day = day_hour($uid, $date, $h)) {
            q('DELETE FROM hours WHERE user_id = ? AND date = ? AND hour = ?', [$uid, $date, $h]);
            put_week_hour($uid, $wd, $h, $day['text'], $day['type'], (int)$day['start_min'], (int)$day['end_min']);
        } elseif ($week = week_hour($uid, $wd, $h)) {
            q('DELETE FROM weekly_hours WHERE user_id = ? AND weekday = ? AND hour = ?', [$uid, $wd, $h]);
            put_day_hour($uid, $date, $h, $week['text'], $week['type'], (int)$week['start_min'], (int)$week['end_min']);
        }
        db()->commit();
        ok();
    }

    case 'hours.clear': {
        $date  = date_in($in, 'date');
        $start = int_in($in, 'start', 0, 23);
        $end   = int_in($in, 'end', 1, 24);
        $wd    = weekday_of($date);
        db()->beginTransaction();
        for ($h = $start; $h < $end; $h++) {
            if (day_hour($uid, $date, $h)) {
                q('DELETE FROM hours WHERE user_id = ? AND date = ? AND hour = ?', [$uid, $date, $h]);
            } else {
                q('DELETE FROM weekly_hours WHERE user_id = ? AND weekday = ? AND hour = ?', [$uid, $wd, $h]);
            }
        }
        db()->commit();
        ok();
    }

    case 'block.add': {
        $date  = date_in($in, 'date');
        $from  = time_in($in, 'from');   // minutes since midnight
        $to    = time_in($in, 'to');
        $title = str_in($in, 'title', 200);
        if ($to <= $from) fail(400, 'The end time has to be after the start time.');
        $wd = weekday_of($date);
        $h0 = intdiv($from, 60);
        $h1 = intdiv($to + 59, 60);       // first hour not touched

        db()->beginTransaction();
        for ($h = $h0; $h < $h1; $h++) {
            $e = day_hour($uid, $date, $h) ?? week_hour($uid, $wd, $h);
            if ($e && trim($e['text']) !== '') {
                db()->rollBack();
                fail(409, sprintf('%02d:00 is already taken. Pick a free time.', $h));
            }
        }
        for ($h = $h0; $h < $h1; $h++) {
            $s = $h === $h0 ? $from % 60 : 0;
            $e = $h === $h1 - 1 ? $to - $h * 60 : 60;
            put_day_hour($uid, $date, $h, $title, 'study', $s, $e);
        }
        db()->commit();
        ok();
    }

    case 'block.done': {
        $key = mb_substr((string)($in['key'] ?? ''), 0, 255);
        if ($key === '') fail(400, 'Missing block.');
        q('DELETE FROM block_done WHERE user_id = ? AND block_key = ?', [$uid, $key]);
        if (!empty($in['done'])) q('INSERT INTO block_done (user_id, block_key) VALUES (?, ?)', [$uid, $key]);
        ok();
    }

    case 'study.save': {
        $wd = int_in($in, 'weekday', 0, 6);
        if (!q('SELECT 1 FROM study_plan WHERE user_id = ? AND weekday = ?', [$uid, $wd])->fetch()) {
            q('INSERT INTO study_plan (user_id, weekday) VALUES (?, ?)', [$uid, $wd]);
        }
        $fields = [];
        if (array_key_exists('subject', $in))  $fields['subject']  = mb_substr(trim((string)$in['subject']), 0, 80);
        if (array_key_exists('topic', $in))    $fields['topic']    = mb_substr(trim((string)$in['topic']), 0, 120);
        if (array_key_exists('hours', $in))    $fields['hours']    = max(0, min(24, round((float)$in['hours'], 1)));
        if (array_key_exists('revised', $in))  $fields['revised']  = empty($in['revised']) ? 0 : 1;
        if (array_key_exists('priority', $in)) $fields['priority'] = max(0, min(2, (int)$in['priority']));
        foreach ($fields as $col => $v) {
            q("UPDATE study_plan SET $col = ? WHERE user_id = ? AND weekday = ?", [$v, $uid, $wd]);
        }
        ok();
    }

    case 'upcoming.add':
        q('INSERT INTO upcoming (user_id, title, date) VALUES (?, ?, ?)',
            [$uid, str_in($in, 'title', 150), date_in($in, 'date')]);
        ok(['id' => db()->lastInsertId()]);

    case 'upcoming.delete':
        q('DELETE FROM upcoming WHERE id = ? AND user_id = ?', [id_in($in), $uid]);
        ok();

    case 'subject.add': {
        $count = (int)q('SELECT COUNT(*) FROM subjects WHERE user_id = ?', [$uid])->fetchColumn();
        $color = SUBJ_COLORS[$count % count(SUBJ_COLORS)];
        q('INSERT INTO subjects (user_id, name, color, exam) VALUES (?, ?, ?, ?)',
            [$uid, str_in($in, 'name', 80), $color, date_in($in, 'exam', false)]);
        ok(['id' => db()->lastInsertId(), 'c' => $color]);
    }

    case 'subject.delete': {
        $id = id_in($in);
        own_subject($uid, $id);
        // Delete children by hand too, in case foreign keys are off (SQLite)
        db()->beginTransaction();
        q('DELETE FROM topics WHERE chapter_id IN (SELECT id FROM chapters WHERE subject_id = ?)', [$id]);
        q('DELETE FROM chapters WHERE subject_id = ?', [$id]);
        q('DELETE FROM subjects WHERE id = ? AND user_id = ?', [$id, $uid]);
        db()->commit();
        ok();
    }

    case 'chapter.add': {
        $sid = id_in($in, 'subject_id');
        own_subject($uid, $sid);
        q('INSERT INTO chapters (subject_id, title) VALUES (?, ?)', [$sid, str_in($in, 'title', 150)]);
        ok(['id' => db()->lastInsertId()]);
    }

    case 'chapter.toggle': {
        // Ticking a chapter ticks (or unticks) all its topics too
        $id = id_in($in);
        own_chapter($uid, $id);
        $done = empty($in['done']) ? 0 : 1;
        q('UPDATE chapters SET done = ? WHERE id = ?', [$done, $id]);
        q('UPDATE topics SET done = ? WHERE chapter_id = ?', [$done, $id]);
        ok();
    }

    case 'chapter.source': {
        // Where to find this chapter: book, author, literature (free text, can be several lines)
        $id = id_in($in);
        own_chapter($uid, $id);
        q('UPDATE chapters SET source = ? WHERE id = ?', [str_in($in, 'source', 2000, false), $id]);
        ok();
    }

    case 'chapter.delete': {
        $id = id_in($in);
        own_chapter($uid, $id);
        q('DELETE FROM topics WHERE chapter_id = ?', [$id]);
        q('DELETE FROM chapters WHERE id = ?', [$id]);
        ok();
    }

    case 'topic.add': {
        $cid = id_in($in, 'chapter_id');
        own_chapter($uid, $cid);
        q('INSERT INTO topics (chapter_id, title) VALUES (?, ?)', [$cid, str_in($in, 'title', 200)]);
        ok(['id' => db()->lastInsertId()]);
    }

    case 'topic.toggle': {
        $id = id_in($in);
        own_topic($uid, $id);
        q('UPDATE topics SET done = ? WHERE id = ?', [empty($in['done']) ? 0 : 1, $id]);
        ok();
    }

    case 'topic.delete': {
        $id = id_in($in);
        own_topic($uid, $id);
        q('DELETE FROM topics WHERE id = ?', [$id]);
        ok();
    }

    case 'gcal.sync': {
        // Send hours to Google Calendar. "dates" = days that were just edited; the same weekday in the next two
        // weeks is sent too, because an edit can change a weekly hour. "full" = the whole next two weeks.
        if (!gcal_configured() || !gcal_account($uid)) fail(400, 'Google Calendar is not connected.');
        if (function_exists('set_time_limit')) set_time_limit(120);   // some hosts turn this off
        $window = gcal_window();
        $dates = !empty($in['full']) ? $window : [];
        foreach (array_slice((array)($in['dates'] ?? []), 0, 31) as $d) {
            $d = date_in(['d' => (string)$d], 'd');
            $dates[] = $d;
            foreach ($window as $w) if (weekday_of($w) === weekday_of($d)) $dates[] = $w;
        }
        $dates = array_values(array_unique($dates));
        sort($dates);
        try {
            $n = gcal_sync_dates($uid, $dates);
        } catch (RuntimeException $e) {
            fail(502, $e->getMessage());
        }
        if (!empty($in['full'])) q('UPDATE google_accounts SET synced_on = ? WHERE user_id = ?', [date('Y-m-d'), $uid]);
        ok(['changed' => $n, 'connected' => (bool)gcal_account($uid)]);
    }

    default:
        fail(404, 'Unknown action.');
    }
} catch (PDOException $e) {
    if (db()->inTransaction()) db()->rollBack();
    error_log('Planner API: ' . $e->getMessage());
    fail(500, 'Could not save to the database. Is MySQL running?');
}
