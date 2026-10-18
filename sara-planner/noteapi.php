<?php
// Saving for the study notebook (notes.php, assets/notes.js). POST noteapi.php?action=...
// JSON for most actions; "file.add" (a study file) and "board.save" (a whiteboard drawing) are sent as form uploads.
// Every query is limited to the logged-in person's own notes.
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

function clean_text($v, int $max): string
{
    $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', (string)$v) ?? '');
    return mb_substr($v, 0, $max);
}

function note_summary(array $n, array $counts): array
{
    $body = trim(preg_replace('/\s+/u', ' ', (string)($n['body'] ?? '')) ?? '');
    return ['id' => (int)$n['id'], 'kind' => $n['kind'], 'title' => $n['title'], 'subject' => $n['subject'],
        'snippet' => mb_substr($body, 0, 90), 'files' => $counts[(int)$n['id']] ?? 0, 'updated' => (int)$n['updated_at'],
        'thumb' => $n['kind'] === 'board' && $n['board'] ? 'notefile.php?board=' . (int)$n['id'] . '&v=' . (int)$n['updated_at'] : ''];
}

function note_full(int $uid, array $n): array
{
    $files = q('SELECT * FROM note_files WHERE note_id = ? AND user_id = ? ORDER BY id', [(int)$n['id'], $uid])->fetchAll();
    return ['id' => (int)$n['id'], 'kind' => $n['kind'], 'title' => $n['title'], 'subject' => $n['subject'], 'body' => (string)($n['body'] ?? ''),
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
        $counts = [];
        foreach (q('SELECT note_id, COUNT(*) c FROM note_files WHERE user_id = ? GROUP BY note_id', [$uid])->fetchAll() as $r) $counts[(int)$r['note_id']] = (int)$r['c'];
        $notes = array_map(fn($n) => note_summary($n, $counts),
            q('SELECT id, kind, title, subject, body, board, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC, id DESC', [$uid])->fetchAll());
        // Subjects from the Study tab, so a page can be filed under one of them
        $subjects = array_column(q('SELECT name FROM subjects WHERE user_id = ? ORDER BY name', [$uid])->fetchAll(), 'name');
        nok(['notes' => $notes, 'subjects' => $subjects, 'limits' => limits($uid)]);

    case 'note.get':
        nok(['note' => note_full($uid, my_note($uid, $in['id'] ?? null))]);

    case 'note.add':
        $kind = in_array($in['kind'] ?? '', NOTE_KINDS, true) ? $in['kind'] : 'note';
        if ((int)q('SELECT COUNT(*) c FROM notes WHERE user_id = ?', [$uid])->fetch()['c'] >= NOTE_MAX_PAGES) nfail(400, 'You have ' . NOTE_MAX_PAGES . ' pages already. Delete some old ones first.');
        $paper = in_array($in['paper'] ?? '', NOTE_PAPERS, true) ? $in['paper'] : ($kind === 'board' ? 'plain' : 'lined');
        q('INSERT INTO notes (user_id, kind, title, subject, body, paper, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$uid, $kind, clean_text($in['title'] ?? '', 120), clean_text($in['subject'] ?? '', 80), '', $paper, time(), time()]);
        nok(['note' => note_full($uid, my_note($uid, db()->lastInsertId()))]);

    case 'note.save':
        $n = my_note($uid, $in['id'] ?? null);
        $body = array_key_exists('body', $in) ? (string)$in['body'] : (string)$n['body'];
        if (mb_strlen($body) > 200000) nfail(400, 'This page is very long. Start a new page for the rest.');
        $paper = in_array($in['paper'] ?? '', NOTE_PAPERS, true) ? $in['paper'] : $n['paper'];
        $title = array_key_exists('title', $in) ? clean_text($in['title'], 120) : $n['title'];
        $subject = array_key_exists('subject', $in) ? clean_text($in['subject'], 80) : $n['subject'];
        q('UPDATE notes SET title = ?, subject = ?, body = ?, paper = ?, updated_at = ? WHERE id = ?', [$title, $subject, $body, $paper, time(), (int)$n['id']]);
        nok(['updated' => time()]);

    case 'note.delete':
        $n = my_note($uid, $in['id'] ?? null);
        foreach (q('SELECT path FROM note_files WHERE note_id = ? AND user_id = ?', [(int)$n['id'], $uid])->fetchAll() as $f) note_unlink($uid, $f['path']);
        note_unlink($uid, $n['board']);
        q('DELETE FROM note_files WHERE note_id = ? AND user_id = ?', [(int)$n['id'], $uid]);
        q('DELETE FROM notes WHERE id = ?', [(int)$n['id']]);
        nok();

    case 'file.add':
        $n = my_note($uid, $in['note_id'] ?? null);
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
        nok(['file' => note_file_out(q('SELECT * FROM note_files WHERE id = ?', [$id])->fetch()), 'used' => usage($uid)]);

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
