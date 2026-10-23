<?php
// Saving for the study notebook (notes.php, assets/notes.js). POST noteapi.php?action=...
// JSON for most actions; "file.add" (a study file) and "board.save" (a whiteboard drawing) are sent as form uploads.
// Every query is limited to the logged-in person's own notes.
// A notebook is a subject from the Study tab; its chapters are the Study chapters. A page sits in a chapter, or loose in its
// notebook, or (when it has neither) in "Other".
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/notes-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function nfail(int $status, string $msg): never
{
    http_response_code($status);
    echo json_encode(['error' => $msg]);
    exit;
}

function nok(array $data = []): never
{
    echo json_encode(['ok' => true] + $data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') nfail(405, 'Use POST.');
$uid = current_user_id();
if (!$uid) nfail(401, 'Please log in again.');
if (!check_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) nfail(403, 'Your session expired. Reload the page.');
if (!is_verified($uid)) nfail(403, 'Confirm your email first.');

$action = (string)($_GET['action'] ?? '');
$in = [];
if (str_starts_with((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
    $in = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($in)) nfail(400, 'Bad request.');
} elseif ($action !== 'file.add' && $action !== 'board.save') {
    nfail(400, 'Bad request.');
} elseif (empty($_POST) && empty($_FILES)) {
    // PHP drops the whole form when it is bigger than post_max_size
    nfail(400, 'That file is too big. The most you can upload is ' . round(note_file_max() / 1048576) . ' MB a file.');
} else {
    $in = $_POST;
}

/** One of my notes, or a 404. */
function my_note(int $uid, $id): array
{
    $n = is_numeric($id) ? q('SELECT * FROM notes WHERE id = ? AND user_id = ?', [(int)$id, $uid])->fetch() : null;
    if (!$n) nfail(404, 'That page was not found. It may have been deleted.');
    return $n;
}

/** One of my chapters (Study tab) with its subject's id and name, or null. */
function my_chapter(int $uid, $id): ?array
{
    if (!is_numeric($id) || (int)$id < 1) return null;
    return q('SELECT c.id, c.title, s.id subject_id, s.name subject FROM chapters c JOIN subjects s ON s.id = c.subject_id WHERE c.id = ? AND s.user_id = ?', [(int)$id, $uid])->fetch() ?: null;
}

/** One of my subjects (a notebook), or null. */
function my_subject(int $uid, $id): ?array
{
    if (!is_numeric($id) || (int)$id < 1) return null;
    return q('SELECT id, name, color FROM subjects WHERE id = ? AND user_id = ?', [(int)$id, $uid])->fetch() ?: null;
}

/** Where a page goes: [its chapter, its notebook]. A chapter brings its own notebook; with neither the page is in "Other". */
function note_place(int $uid, array $in): array
{
    $ch = my_chapter($uid, $in['chapter_id'] ?? null);
    if ($ch) return [$ch, ['id' => $ch['subject_id'], 'name' => $ch['subject']]];
    return [null, my_subject($uid, $in['subject_id'] ?? null)];
}

/** My notebooks (subjects) and their chapters, as the page needs them: [books by id, chapters by id]. */
function note_books(int $uid): array
{
    $books = [];
    foreach (q('SELECT id, name, color FROM subjects WHERE user_id = ? ORDER BY id', [$uid])->fetchAll() as $s) {
        $books[(int)$s['id']] = ['id' => (int)$s['id'], 'name' => $s['name'], 'c' => preg_match('/^[a-z]+$/', (string)$s['color']) ? $s['color'] : 'school', 'chapters' => []];
    }
    $chapters = [];
    foreach (q('SELECT c.id, c.subject_id, c.title FROM chapters c JOIN subjects s ON s.id = c.subject_id WHERE s.user_id = ? ORDER BY c.id', [$uid])->fetchAll() as $c) {
        $chapters[(int)$c['id']] = ['id' => (int)$c['id'], 'subject_id' => (int)$c['subject_id'], 'title' => $c['title']];
        if (isset($books[(int)$c['subject_id']])) $books[(int)$c['subject_id']]['chapters'][] = ['id' => (int)$c['id'], 'title' => $c['title']];
    }
    return [$books, $chapters];
}

/**
 * The notebook and chapter a page is in now: [notebook id, chapter id], 0 for none. The chapter decides first, then the notebook it
 * was filed under; pages from before notebooks existed are matched by their subject's name. A deleted subject or chapter leaves the
 * page in "Other", so nothing is ever lost.
 */
function note_home(array $n, array $books, array $chapters): array
{
    $cid = (int)($n['chapter_id'] ?? 0);
    if ($cid && isset($chapters[$cid])) return [$chapters[$cid]['subject_id'], $cid];
    $sid = (int)($n['subject_id'] ?? 0);
    if ($sid && isset($books[$sid])) return [$sid, 0];
    $name = mb_strtolower(trim((string)($n['subject'] ?? '')));
    if ($name !== '') foreach ($books as $b) if (mb_strtolower($b['name']) === $name) return [$b['id'], 0];
    return [0, 0];
}

/** Add a page in a chapter and/or notebook (the chapter's title and the notebook's name fill in what's missing). */
function add_note(int $uid, string $kind, string $title, ?array $ch, ?array $book, ?string $paper = null): array
{
    if ((int)q('SELECT COUNT(*) c FROM notes WHERE user_id = ?', [$uid])->fetch()['c'] >= NOTE_MAX_PAGES) nfail(400, 'You have ' . NOTE_MAX_PAGES . ' pages already. Delete some old ones first.');
    if ($ch && $title === '') $title = mb_substr($ch['title'], 0, 120);
    $paper = in_array($paper, NOTE_PAPERS, true) ? $paper : ($kind === 'board' ? 'plain' : 'lined');
    q('INSERT INTO notes (user_id, kind, title, subject, subject_id, chapter_id, body, paper, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$uid, $kind, $title, $book ? mb_substr($book['name'], 0, 80) : '', $book ? (int)$book['id'] : null, $ch ? (int)$ch['id'] : null, '', $paper, time(), time()]);
    return my_note($uid, db()->lastInsertId());
}

function clean_text($v, int $max): string
{
    $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', (string)$v) ?? '');
    return mb_substr($v, 0, $max);
}

function note_summary(array $n, array $books, array $chapters): array
{
    $body = trim(preg_replace('/\s+/u', ' ', (string)($n['body'] ?? '')) ?? '');
    [$sid, $cid] = note_home($n, $books, $chapters);
    return ['id' => (int)$n['id'], 'kind' => $n['kind'], 'title' => $n['title'], 'sid' => $sid, 'cid' => $cid,
        'snippet' => mb_substr($body, 0, 90), 'updated' => (int)$n['updated_at'],
        'thumb' => $n['kind'] === 'board' && $n['board'] ? 'notefile.php?board=' . (int)$n['id'] . '&v=' . (int)$n['updated_at'] : ''];
}

function note_full(int $uid, array $n): array
{
    $files = q('SELECT * FROM note_files WHERE note_id = ? AND user_id = ? ORDER BY id', [(int)$n['id'], $uid])->fetchAll();
    [$books, $chapters] = note_books($uid);
    [$sid, $cid] = note_home($n, $books, $chapters);
    return ['id' => (int)$n['id'], 'kind' => $n['kind'], 'title' => $n['title'], 'sid' => $sid, 'cid' => $cid, 'body' => (string)($n['body'] ?? ''),
        'paper' => $n['paper'], 'updated' => (int)$n['updated_at'],
        'board' => $n['board'] ? 'notefile.php?board=' . (int)$n['id'] . '&v=' . (int)$n['updated_at'] : '',
        'files' => array_map('note_file_out', $files)];
}

function usage(int $uid): array
{
    $r = q('SELECT COUNT(*) c, COALESCE(SUM(size), 0) s FROM note_files WHERE user_id = ?', [$uid])->fetch();
    return ['count' => (int)$r['c'], 'bytes' => (int)$r['s']];
}

function limits(int $uid): array
{
    return ['file_max' => note_file_max(), 'total_max' => NOTE_MAX_TOTAL, 'files_max' => NOTE_MAX_FILES, 'types' => array_keys(NOTE_TYPES)] + ['used' => usage($uid)];
}

switch ($action) {
    case 'note.list':
        [$books, $chapters] = note_books($uid);
        $files = array_map('note_file_out', q('SELECT * FROM note_files WHERE user_id = ? ORDER BY id', [$uid])->fetchAll());
        $notes = array_map(fn($n) => note_summary($n, $books, $chapters),
            q('SELECT id, kind, title, subject, subject_id, chapter_id, body, board, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC, id DESC', [$uid])->fetchAll());
        nok(['notes' => $notes, 'books' => array_values($books), 'files' => $files, 'limits' => limits($uid)]);

    case 'note.get':
        nok(['note' => note_full($uid, my_note($uid, $in['id'] ?? null))]);

    case 'book.add':
        // A new notebook is a new subject: it shows up in the Study tab too
        $name = clean_text($in['name'] ?? '', 80);
        if ($name === '') nfail(400, 'Give the notebook a name.');
        $count = (int)q('SELECT COUNT(*) c FROM subjects WHERE user_id = ?', [$uid])->fetch()['c'];
        q('INSERT INTO subjects (user_id, name, color) VALUES (?, ?, ?)', [$uid, $name, SUBJ_COLORS[$count % count(SUBJ_COLORS)]]);
        $id = (int)db()->lastInsertId();
        nok(['book' => ['id' => $id, 'name' => $name, 'c' => SUBJ_COLORS[$count % count(SUBJ_COLORS)], 'chapters' => []]]);

    case 'chapter.add':
        // A new chapter in a notebook is a new chapter of that subject in the Study tab
        $book = my_subject($uid, $in['subject_id'] ?? null);
        if (!$book) nfail(404, 'That notebook was not found. It may have been deleted.');
        $title = clean_text($in['title'] ?? '', 150);
        if ($title === '') nfail(400, 'Give the chapter a name.');
        q('INSERT INTO chapters (subject_id, title) VALUES (?, ?)', [(int)$book['id'], $title]);
        nok(['chapter' => ['id' => (int)db()->lastInsertId(), 'title' => $title]]);

    case 'note.add':
        $kind = in_array($in['kind'] ?? '', NOTE_KINDS, true) ? $in['kind'] : 'note';
        [$ch, $book] = note_place($uid, $in);
        $n = add_note($uid, $kind, clean_text($in['title'] ?? '', 120), $ch, $book, $in['paper'] ?? null);
        nok(['note' => note_full($uid, $n)]);

    case 'note.save':
        $n = my_note($uid, $in['id'] ?? null);
        $body = array_key_exists('body', $in) ? (string)$in['body'] : (string)$n['body'];
        if (mb_strlen($body) > 200000) nfail(400, 'This page is very long. Start a new page for the rest.');
        $paper = in_array($in['paper'] ?? '', NOTE_PAPERS, true) ? $in['paper'] : $n['paper'];
        $title = array_key_exists('title', $in) ? clean_text($in['title'], 120) : $n['title'];
        $subject = $n['subject'];
        $subjectId = $n['subject_id'];
        $chapterId = $n['chapter_id'];
        if (array_key_exists('chapter_id', $in) || array_key_exists('subject_id', $in)) {
            // Moved to another notebook or chapter
            [$ch, $book] = note_place($uid, $in);
            $subject = $book ? mb_substr($book['name'], 0, 80) : '';
            $subjectId = $book ? (int)$book['id'] : null;
            $chapterId = $ch ? (int)$ch['id'] : null;
        }
        q('UPDATE notes SET title = ?, subject = ?, subject_id = ?, chapter_id = ?, body = ?, paper = ?, updated_at = ? WHERE id = ?',
            [$title, $subject, $subjectId, $chapterId, $body, $paper, time(), (int)$n['id']]);
        nok(['updated' => time()]);

    case 'note.delete':
        $n = my_note($uid, $in['id'] ?? null);
        foreach (q('SELECT path FROM note_files WHERE note_id = ? AND user_id = ?', [(int)$n['id'], $uid])->fetchAll() as $f) note_unlink($uid, $f['path']);
        note_unlink($uid, $n['board']);
        q('DELETE FROM note_files WHERE note_id = ? AND user_id = ?', [(int)$n['id'], $uid]);
        q('DELETE FROM notes WHERE id = ?', [(int)$n['id']]);
        nok();

    case 'file.add':
        if (!empty($in['chapter_id'])) {
            // Uploaded to a chapter (from the Study tab or its notebook): it goes on that chapter's notes page (made the first time)
            $ch = my_chapter($uid, $in['chapter_id']);
            if (!$ch) nfail(404, 'That chapter was not found. It may have been deleted.');
            $n = q("SELECT * FROM notes WHERE user_id = ? AND chapter_id = ? AND kind = 'note' ORDER BY id LIMIT 1", [$uid, (int)$ch['id']])->fetch()
                ?: add_note($uid, 'note', '', $ch, ['id' => $ch['subject_id'], 'name' => $ch['subject']]);
        } elseif (!empty($in['subject_id'])) {
            // Uploaded to a notebook, outside any chapter: it goes on the notebook's general files page
            $book = my_subject($uid, $in['subject_id']);
            if (!$book) nfail(404, 'That notebook was not found. It may have been deleted.');
            $n = q("SELECT * FROM notes WHERE user_id = ? AND subject_id = ? AND chapter_id IS NULL AND kind = 'note' ORDER BY id LIMIT 1", [$uid, (int)$book['id']])->fetch()
                ?: add_note($uid, 'note', 'Study files', null, $book);
        } else {
            $n = my_note($uid, $in['note_id'] ?? null);
        }
        $f = $_FILES['file'] ?? null;
        $max = note_file_max();
        $mb = round($max / 1048576);
        if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            $big = $f && in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
            nfail(400, $big ? "That file is too big. The most you can upload is $mb MB a file." : 'The file did not upload. Try again.');
        }
        if ($f['size'] > $max) nfail(400, "That file is too big. The most you can upload is $mb MB a file.");
        $name = clean_text(basename(str_replace('\\', '/', (string)$f['name'])), 160);
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!isset(NOTE_TYPES[$ext])) nfail(400, 'That kind of file can\'t be added. You can add PDF, Word, PowerPoint, Excel, text, pictures, music and short videos.');
        $mime = NOTE_TYPES[$ext];
        if (str_starts_with($mime, 'image/')) {
            $info = @getimagesize($f['tmp_name']);
            $real = [IMAGETYPE_JPEG => ['image/jpeg', 'jpg'], IMAGETYPE_PNG => ['image/png', 'png'], IMAGETYPE_GIF => ['image/gif', 'gif'], IMAGETYPE_WEBP => ['image/webp', 'webp']];
            if (!$info || !isset($real[$info[2]])) nfail(400, 'That picture seems to be broken. Try saving it again as a JPG or PNG.');
            [$mime, $ext] = $real[$info[2]];   // a phone sometimes names a JPG ".png": go by what it really is
        }
        $use = usage($uid);
        if ($use['count'] >= NOTE_MAX_FILES) nfail(400, 'You have ' . NOTE_MAX_FILES . ' files already. Delete some old ones first.');
        if ($use['bytes'] + $f['size'] > NOTE_MAX_TOTAL) nfail(400, 'Your notebook is full (' . (NOTE_MAX_TOTAL / 1048576) . ' MB of files). Delete some old files first.');
        try {
            $path = note_store($uid, $ext, $f['tmp_name']);
        } catch (RuntimeException $e) {
            nfail(500, $e->getMessage());
        }
        if ($name === '' || $name === '.' . $ext) $name = 'file.' . $ext;
        q('INSERT INTO note_files (user_id, note_id, name, mime, size, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [$uid, (int)$n['id'], $name, $mime, (int)$f['size'], $path, time()]);
        $id = (int)db()->lastInsertId();
        q('UPDATE notes SET updated_at = ? WHERE id = ?', [time(), (int)$n['id']]);
        nok(['file' => note_file_out(q('SELECT * FROM note_files WHERE id = ?', [$id])->fetch()), 'page' => (int)$n['id'], 'used' => usage($uid)]);

    case 'file.delete':
        $f = is_numeric($in['id'] ?? null) ? q('SELECT * FROM note_files WHERE id = ? AND user_id = ?', [(int)$in['id'], $uid])->fetch() : null;
        if (!$f) nfail(404, 'That file was not found.');
        note_unlink($uid, $f['path']);
        q('DELETE FROM note_files WHERE id = ?', [(int)$f['id']]);
        nok(['used' => usage($uid)]);

    case 'board.save':
        $n = my_note($uid, $in['note_id'] ?? null);
        $f = $_FILES['image'] ?? null;
        if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) nfail(400, 'The drawing did not save. Try again.');
        if ($f['size'] > note_file_max()) nfail(400, 'This drawing is too big to save. Try clearing a picture from it.');
        $info = @getimagesize($f['tmp_name']);
        if (!$info || $info[2] !== IMAGETYPE_PNG || $info[0] > 4000 || $info[1] > 4000) nfail(400, 'The drawing did not save. Try again.');
        try {
            $path = note_store($uid, 'png', $f['tmp_name']);
        } catch (RuntimeException $e) {
            nfail(500, $e->getMessage());
        }
        note_unlink($uid, $n['board']);
        $now = time();
        $title = array_key_exists('title', $in) ? clean_text($in['title'], 120) : $n['title'];
        $subject = array_key_exists('subject', $in) ? clean_text($in['subject'], 80) : $n['subject'];
        $paper = in_array($in['paper'] ?? '', NOTE_PAPERS, true) ? $in['paper'] : $n['paper'];
        q('UPDATE notes SET board = ?, title = ?, subject = ?, paper = ?, updated_at = ? WHERE id = ?', [$path, $title, $subject, $paper, $now, (int)$n['id']]);
        nok(['board' => 'notefile.php?board=' . (int)$n['id'] . '&v=' . $now, 'updated' => $now]);
}
nfail(400, 'Unknown action.');
