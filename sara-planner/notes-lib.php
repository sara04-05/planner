<?php
// The study notebook (notes.php): shared helpers for noteapi.php (saving) and notefile.php (sending files).
// Notes are private: only their owner can open them. Study files and whiteboard drawings are kept on disk in
// data/notes/<user id>/ (data/ is closed to the web by its .htaccess), so big PDFs don't fill up the database.
declare(strict_types=1);

const NOTE_KINDS      = ['note', 'board'];
const NOTE_PAPERS     = ['lined', 'grid', 'dots', 'plain'];
const NOTE_MAX_PAGES  = 500;
const NOTE_MAX_FILES  = 200;                 // files per person
const NOTE_MAX_TOTAL  = 100 * 1024 * 1024;   // 100 MB of files per person
const NOTE_FILE_LIMIT = 10 * 1024 * 1024;    // 10 MB a file: InfinityFree's upload limit (less if the host's PHP allows less)

// What can be uploaded, by file ending. SVG and HTML are left out on purpose (they could run scripts).
const NOTE_TYPES = [
    'pdf' => 'application/pdf',
    'doc' => 'application/msword', 'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt' => 'application/vnd.ms-powerpoint', 'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls' => 'application/vnd.ms-excel', 'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'odt' => 'application/vnd.oasis.opendocument.text', 'odp' => 'application/vnd.oasis.opendocument.presentation', 'ods' => 'application/vnd.oasis.opendocument.spreadsheet',
    'rtf' => 'application/rtf', 'txt' => 'text/plain', 'csv' => 'text/csv', 'md' => 'text/plain',
    'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp',
    'mp3' => 'audio/mpeg', 'm4a' => 'audio/mp4', 'wav' => 'audio/wav', 'ogg' => 'audio/ogg', 'mid' => 'audio/midi', 'midi' => 'audio/midi',
    'mp4' => 'video/mp4', 'mov' => 'video/quicktime',
];

/** Bytes from a php.ini size like "8M". */
function ini_bytes(string $v): int
{
    $v = trim($v);
    if ($v === '') return 0;
    $n = (int)$v;
    return match (strtolower(substr($v, -1))) { 'g' => $n * 1024 ** 3, 'm' => $n * 1024 ** 2, 'k' => $n * 1024, default => $n };
}

/** The biggest file that can be uploaded here: 10 MB, or less when the host's PHP settings say so. */
function note_file_max(): int
{
    $max = NOTE_FILE_LIMIT;
    foreach (['upload_max_filesize', 'post_max_size'] as $k) {
        $b = ini_bytes((string)ini_get($k));
        if ($b > 0) $max = min($max, $k === 'post_max_size' ? $b - 64 * 1024 : $b);
    }
    return max(1024 * 1024, $max);
}

function notes_dir(int $uid): string
{
    return __DIR__ . '/data/notes/' . $uid;
}

/** Where a stored file is. Only names this site made itself (letters, numbers, dot, dash) are accepted. */
function note_path(int $uid, string $name): ?string
{
    return preg_match('/^[a-z0-9.-]{8,80}$/', $name) ? notes_dir($uid) . '/' . $name : null;
}

/** Keep $bytes (or move the uploaded file $tmp) in the person's folder; returns the stored name. */
function note_store(int $uid, string $ext, ?string $tmp = null, ?string $bytes = null): string
{
    $dir = notes_dir($uid);
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) throw new RuntimeException('The site could not make a folder for your files. Ask the site owner to check that the data folder can be written to.');
    $name = bin2hex(random_bytes(12)) . '.' . $ext;
    $ok = $tmp !== null ? @move_uploaded_file($tmp, "$dir/$name") : @file_put_contents("$dir/$name", (string)$bytes) !== false;
    if (!$ok) throw new RuntimeException('The file could not be saved on the server. Try again.');
    return $name;
}

function note_unlink(int $uid, ?string $name): void
{
    if ($name && ($p = note_path($uid, $name)) && is_file($p)) @unlink($p);
}

/** Remove someone's whole notes folder (when their account is deleted). */
function notes_wipe(int $uid): void
{
    $dir = notes_dir($uid);
    if (!is_dir($dir)) return;
    foreach ((array)glob($dir . '/*') as $f) if (is_file($f)) @unlink($f);
    @rmdir($dir);
}

/** "image", "audio", "video", "pdf" or "file": how the page shows it. */
function note_file_kind(string $mime): string
{
    if (str_starts_with($mime, 'image/')) return 'image';
    if ($mime === 'audio/midi') return 'file';
    if (str_starts_with($mime, 'audio/')) return 'audio';
    if (str_starts_with($mime, 'video/')) return 'video';
    return $mime === 'application/pdf' ? 'pdf' : 'file';
}

function note_file_out(array $f): array
{
    return ['id' => (int)$f['id'], 'note' => (int)$f['note_id'], 'name' => $f['name'], 'size' => (int)$f['size'], 'mime' => $f['mime'],
        'kind' => note_file_kind($f['mime']), 'url' => 'notefile.php?id=' . (int)$f['id']];
}
