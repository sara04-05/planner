<?php
// Sends one notebook picture (blog photo, interest picture, cover, sticker). Pictures are kept in the database,
// and only people who may see the post / list / notebook it belongs to get it.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';

$viewer = current_user_id();
$id = isset($_GET['id']) && ctype_digit((string)$_GET['id']) ? (int)$_GET['id'] : 0;
$row = $id && can_see_upload($id, $viewer) ? q('SELECT mime, data FROM uploads WHERE id = ?', [$id])->fetch() : null;
if (!$row || !in_array($row['mime'], ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true)) {
    http_response_code(404);
    exit;
}
header('Content-Type: ' . $row['mime']);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=604800');   // a picture never changes; a new one gets a new id
echo base64_decode($row['data']);
