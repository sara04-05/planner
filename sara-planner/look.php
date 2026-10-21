<?php
// Saves the colour look a signed-in person picked for the whole site (assets/looks.js). POST look.php with {"look": "slug"}.
declare(strict_types=1);
require __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$uid = current_user_id();
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !$uid) {
    http_response_code($uid ? 405 : 401);
    echo json_encode(['error' => 'Not allowed.']);
    exit;
}
if (!check_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
    http_response_code(403);
    echo json_encode(['error' => 'Your session expired. Reload the page.']);
    exit;
}
$in = json_decode((string)file_get_contents('php://input'), true);
$look = is_array($in) ? (string)($in['look'] ?? '') : '';
if (!look_find($look)) {
    http_response_code(400);
    echo json_encode(['error' => 'Unknown look.']);
    exit;
}
q('UPDATE profiles SET look = ? WHERE user_id = ?', [$look, $uid]);

// notebooks still in the colours of a look (or the defaults) take the new look too; colours picked by hand stay
$lk = look_find($look);
try {
    $restyle = function (string $table, string $col, string $key, $val) use ($lk): void {
        foreach (q("SELECT $key AS k, design FROM $table WHERE $col = ?", [$val])->fetchAll() as $r) {
            $d = json_decode((string)($r['design'] ?? ''), true);
            if (!is_array($d)) continue;
            $n = design_from_look($d, $lk);
            if ($n !== $d) q("UPDATE $table SET design = ? WHERE $key = ?", [json_encode($n), $r['k']]);
        }
    };
    $restyle('profiles', 'user_id', 'user_id', $uid);
    $restyle('notebooks', 'user_id', 'id', $uid);
} catch (Throwable $e) {
    error_log('look.php could not restyle the notebooks: ' . $e->getMessage());
}
echo json_encode(['ok' => true]);
