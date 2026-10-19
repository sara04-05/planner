<?php
// Picture upload for the notebook (blog pictures, clothes, stickers, covers). POST multipart: file + kind.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function up_fail(int $status, string $msg): never
{
    http_response_code($status);
    echo json_encode(['error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') up_fail(405, 'Use POST.');
$uid = current_user_id();
if (!$uid) up_fail(401, 'Please log in again.');
if (!check_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) up_fail(403, 'Your session expired. Reload the page.');
if (!is_verified($uid)) up_fail(403, 'Confirm your email first.');

$kind = (string)($_POST['kind'] ?? 'photo');
if (!in_array($kind, ['photo', 'cover', 'sticker', 'avatar'], true)) up_fail(400, 'Unknown picture type.');
if (empty($_FILES['file'])) up_fail(400, 'Choose a picture first (it may be bigger than the server allows).');

if ($kind === 'avatar') {   // your profile picture (cropped to a square)
    [$data, $err] = avatar_from_upload($_FILES['file']);
    if (!$data) up_fail(400, $err);
    ensure_profile($uid);
    q('UPDATE profiles SET avatar = ?, avatar_v = ? WHERE user_id = ?', [$data, time(), $uid]);
    $v = (int)q('SELECT avatar_v FROM profiles WHERE user_id = ?', [$uid])->fetch()['avatar_v'];
    echo json_encode(['ok' => true, 'url' => 'avatar.php?id=' . $uid . '&v=' . $v]);
    exit;
}

try {
    $id = save_image($uid, $_FILES['file'], $kind);
    echo json_encode(['ok' => true, 'id' => $id, 'url' => upload_url($id)]);
} catch (RuntimeException $e) {
    up_fail(400, $e->getMessage());
}
