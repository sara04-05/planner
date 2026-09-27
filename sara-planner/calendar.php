<?php
// Connect / disconnect Google Calendar.
//   calendar.php?start=1        sends you to Google to allow access
//   calendar.php?code=...       Google sends you back here
//   POST calendar.php (disconnect, with the CSRF token)
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/gcal.php';

$uid = require_login();

function back(string $result): never
{
    header('Location: index.php?gcal=' . urlencode($result));
    exit;
}

if (!gcal_configured()) back('not-set-up');

// ---- disconnect ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!check_csrf($_POST['csrf'] ?? null)) back('error');
    if ($acc = gcal_account($uid)) {
        try {
            gcal_http('POST', 'https://oauth2.googleapis.com/revoke', null, ['token' => $acc['refresh_token']]);
        } catch (RuntimeException $e) {
            error_log('Google revoke: ' . $e->getMessage());
        }
        gcal_forget($uid);
    }
    back('disconnected');
}

// ---- step 1: off to Google ----
if (isset($_GET['start'])) {
    $_SESSION['gcal_state'] = bin2hex(random_bytes(16));
    header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id'     => GOOGLE_CLIENT_ID,
        'redirect_uri'  => gcal_redirect_uri(),
        'response_type' => 'code',
        'scope'         => GCAL_SCOPE,
        'access_type'   => 'offline',   // so the planner can keep syncing later
        'prompt'        => 'consent',
        'state'         => $_SESSION['gcal_state'],
    ]));
    exit;
}

// ---- step 2: back from Google ----
$state = (string)($_GET['state'] ?? '');
$expected = (string)($_SESSION['gcal_state'] ?? '');
unset($_SESSION['gcal_state']);
if ($expected === '' || !hash_equals($expected, $state)) back('error');
if (isset($_GET['error'])) back('cancelled');   // "Cancel" on Google's page

try {
    [$st, $tok] = gcal_http('POST', 'https://oauth2.googleapis.com/token', null, [
        'code' => (string)($_GET['code'] ?? ''), 'client_id' => GOOGLE_CLIENT_ID, 'client_secret' => GOOGLE_CLIENT_SECRET,
        'redirect_uri' => gcal_redirect_uri(), 'grant_type' => 'authorization_code',
    ]);
} catch (RuntimeException $e) {
    error_log('Google token: ' . $e->getMessage());
    back('error');
}
if ($st !== 200 || empty($tok['access_token']) || empty($tok['refresh_token'])) {
    error_log('Google token: ' . json_encode($tok));
    back('error');
}
if (!str_contains((string)($tok['scope'] ?? ''), 'calendar')) back('no-calendar');   // the calendar box was unticked

// The id_token comes straight from Google over HTTPS, so its email can be read without checking the signature
$email = '';
if (!empty($tok['id_token'])) {
    $parts = explode('.', $tok['id_token']);
    $claims = json_decode(base64_decode(strtr($parts[1] ?? '', '-_', '+/')), true);
    $email = mb_substr((string)($claims['email'] ?? ''), 0, 190);
}

$old = gcal_account($uid);
if ($old && $old['google_email'] === $email) {   // same Google account again: keep using its Splanner calendar
    q('UPDATE google_accounts SET refresh_token = ?, access_token = ?, expires_at = ?, synced_on = NULL WHERE user_id = ?',
        [$tok['refresh_token'], $tok['access_token'], time() + (int)($tok['expires_in'] ?? 3600), $uid]);
    back('connected');
}
gcal_forget($uid);
q('INSERT INTO google_accounts (user_id, google_email, refresh_token, access_token, expires_at) VALUES (?, ?, ?, ?, ?)',
    [$uid, $email, $tok['refresh_token'], $tok['access_token'], time() + (int)($tok['expires_in'] ?? 3600)]);
back('connected');
