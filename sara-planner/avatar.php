<?php
// Sends one user's profile picture. Pictures are kept in the database (profiles.avatar), see profile.php.
declare(strict_types=1);
require __DIR__ . '/db.php';

if (!current_user_id()) { http_response_code(401); exit; }
$id = isset($_GET['id']) && ctype_digit((string)$_GET['id']) ? (int)$_GET['id'] : 0;
$row = $id ? q('SELECT avatar FROM profiles WHERE user_id = ?', [$id])->fetch() : null;
if (!$row || !$row['avatar'] || !preg_match('#^(image/(?:jpeg|png|webp|gif));(.+)$#s', $row['avatar'], $m)) {
    http_response_code(404);
    exit;
}
header('Content-Type: ' . $m[1]);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=2592000');   // the page adds ?v=<version>, so a new picture gets a new address
echo base64_decode($m[2]);
