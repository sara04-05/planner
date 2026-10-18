<?php
// Sends one study file (?id=) or a whiteboard drawing (?board=<note id>) from the study notebook. Only to its owner.
// Pictures, PDFs, music and videos open in the browser; other files download (?dl=1 always downloads).
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/notes-lib.php';

function gone(): never
{
    http_response_code(404);
    exit;
}

$uid = current_user_id();
if (!$uid) gone();
$num = fn(string $k) => isset($_GET[$k]) && ctype_digit((string)$_GET[$k]) ? (int)$_GET[$k] : 0;

if ($id = $num('board')) {
    $n = q('SELECT board FROM notes WHERE id = ? AND user_id = ?', [$id, $uid])->fetch();
    if (!$n || !$n['board']) gone();
    $row = ['path' => $n['board'], 'mime' => 'image/png', 'name' => 'whiteboard.png'];
} elseif ($id = $num('id')) {
    $row = q('SELECT path, mime, name FROM note_files WHERE id = ? AND user_id = ?', [$id, $uid])->fetch();
    if (!$row) gone();
} else {
    gone();
}
$path = note_path($uid, $row['path']);
if (!$path || !is_file($path)) gone();

$size = (int)filesize($path);
$inline = empty($_GET['dl']) && in_array(note_file_kind($row['mime']), ['image', 'pdf', 'audio', 'video'], true);
$mime = $row['mime'] === 'text/csv' ? 'text/plain' : $row['mime'];
$ascii = preg_replace('/[^A-Za-z0-9._ -]/', '_', $row['name']);
header('Content-Type: ' . $mime . (str_starts_with($mime, 'text/') ? '; charset=utf-8' : ''));
header('X-Content-Type-Options: nosniff');
header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($row['name']));
header('Cache-Control: private, max-age=86400');
header('Accept-Ranges: bytes');

// Music and videos ask for parts of the file, so you can skip ahead
$start = 0;
$end = $size - 1;
if (preg_match('/^bytes=(\d*)-(\d*)$/', (string)($_SERVER['HTTP_RANGE'] ?? ''), $m) && ($m[1] !== '' || $m[2] !== '')) {
    if ($m[1] === '') { $start = max(0, $size - (int)$m[2]); }
    else { $start = (int)$m[1]; if ($m[2] !== '') $end = min($end, (int)$m[2]); }
    if ($start > $end || $start >= $size) {
        http_response_code(416);
        header("Content-Range: bytes */$size");
        exit;
    }
    http_response_code(206);
    header("Content-Range: bytes $start-$end/$size");
}
header('Content-Length: ' . ($end - $start + 1));
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') exit;

$fh = fopen($path, 'rb');
fseek($fh, $start);
$left = $end - $start + 1;
while ($left > 0 && !feof($fh)) {
    $chunk = fread($fh, min(65536, $left));
    if ($chunk === false) break;
    echo $chunk;
    $left -= strlen($chunk);
}
fclose($fh);
