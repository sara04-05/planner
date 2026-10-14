<?php
// Saves your name, picture and notebook cover (the bio and page name are saved by api.php x.profile.save).
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/social.php';

$uid = require_login();

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

// The profile form lives in the Profile tab of the planner (index.php). This file only saves it and answers with JSON.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php?tab=profile');
    exit;
}
header('Content-Type: application/json; charset=utf-8');
function done(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body);
    exit;
}
if (!check_csrf($_POST['csrf'] ?? null)) done(403, ['error' => 'Your session expired. Please reload the page.']);

$name  = trim((string)($_POST['name'] ?? ''));
$cover = resolve_cover((string)($_POST['cover'] ?? DEFAULT_COVER));
$words = mb_substr(trim((string)($_POST['words'] ?? '')), 0, 60);
$avatar = false;   // false = keep the picture as it is
if (!empty($_POST['remove_avatar'])) $avatar = null;
if (!empty($_FILES['avatar']) && $_FILES['avatar']['error'] !== UPLOAD_ERR_NO_FILE) {
    [$avatar, $error] = avatar_from_upload($_FILES['avatar']);
    if ($error) done(422, ['error' => $error]);
}
if ($name === '') done(422, ['error' => 'Please fill in your name.']);

q('UPDATE users SET name = ? WHERE id = ?', [mb_substr($name, 0, 80), $uid]);
if (!q('SELECT 1 FROM profiles WHERE user_id = ?', [$uid])->fetch()) {
    q('INSERT INTO profiles (user_id) VALUES (?)', [$uid]);
}
q('UPDATE profiles SET cover = ? WHERE user_id = ?', [$cover, $uid]);
try {
    q('UPDATE profiles SET words = ? WHERE user_id = ?', [$words, $uid]);
} catch (PDOException $e) {   // words column couldn't be added on this host
    error_log('Could not save cover words: ' . $e->getMessage());
}
if ($avatar !== false) {
    q('UPDATE profiles SET avatar = ?, avatar_v = ? WHERE user_id = ?', [$avatar, $avatar ? time() : 0, $uid]);
}
done(200, ['ok' => true]);
