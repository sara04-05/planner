<?php
// Spotify: the music player's link to people's own Spotify accounts.
// Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in config.php (see README). Without them the Music page
// still plays any Spotify link through Spotify's own player, just without "Connect Spotify".
// One Client ID serves every user: each person logs in to Spotify once and Spotify gives Splanner their own key.
declare(strict_types=1);

// What Splanner may do in a connected account: play in the browser (streaming + the two "read" scopes the
// Web Playback SDK needs), see and change what is playing, and list the person's playlists.
const SPOTIFY_SCOPE = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative';

function spotify_configured(): bool
{
    return defined('SPOTIFY_CLIENT_ID') && SPOTIFY_CLIENT_ID !== '' && defined('SPOTIFY_CLIENT_SECRET') && SPOTIFY_CLIENT_SECRET !== '';
}

/** The address Spotify sends people back to. Must be added in the Spotify dashboard exactly like this.
 *  Spotify only accepts https addresses (or http://127.0.0.1 on your own computer). */
function spotify_redirect_uri(): string
{
    if (defined('SPOTIFY_REDIRECT_URI') && SPOTIFY_REDIRECT_URI !== '') return SPOTIFY_REDIRECT_URI;
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $local = preg_match('/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/', $host);
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return ($local ? 'http' : 'https') . '://' . $host . $dir . '/music.php';
}

/** A small HTTP client. Returns [status code, decoded JSON body]. */
function spotify_http(string $method, string $url, ?array $form = null, ?string $token = null): array
{
    $headers = ['Accept: application/json'];
    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    } else {   // the token endpoint: the app logs in with its own Client ID and secret
        $headers[] = 'Authorization: Basic ' . base64_encode(SPOTIFY_CLIENT_ID . ':' . SPOTIFY_CLIENT_SECRET);
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => array_merge($headers, $form !== null ? ['Content-Type: application/x-www-form-urlencoded'] : []),
        CURLOPT_TIMEOUT        => 20,
    ]);
    if ($form !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($form));
    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        throw new RuntimeException("Couldn't reach Spotify ($err).");
    }
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    return [$status, json_decode((string)$raw, true) ?: []];
}

function spotify_account(int $uid): ?array
{
    try {
        return q('SELECT * FROM spotify_accounts WHERE user_id = ?', [$uid])->fetch() ?: null;
    } catch (PDOException $e) {
        return null;
    }
}

/** A working access token, refreshed when the old one ran out. */
function spotify_token(int $uid, array &$acc): string
{
    if ($acc['access_token'] && (int)$acc['expires_at'] > time() + 60) return $acc['access_token'];
    [$st, $r] = spotify_http('POST', 'https://accounts.spotify.com/api/token', [
        'grant_type' => 'refresh_token', 'refresh_token' => $acc['refresh_token'],
    ]);
    if ($st !== 200 || empty($r['access_token'])) {
        if (($r['error'] ?? '') === 'invalid_grant') {
            spotify_forget($uid);   // access was removed in the Spotify account
            throw new RuntimeException('Spotify was disconnected. Connect it again to play your music.');
        }
        throw new RuntimeException("Spotify didn't accept the login. Try again in a minute.");
    }
    $acc['access_token'] = $r['access_token'];
    $acc['expires_at'] = time() + (int)($r['expires_in'] ?? 3600);
    if (!empty($r['refresh_token'])) $acc['refresh_token'] = $r['refresh_token'];   // Spotify sometimes hands out a new one
    q('UPDATE spotify_accounts SET access_token = ?, expires_at = ?, refresh_token = ? WHERE user_id = ?',
        [$acc['access_token'], $acc['expires_at'], $acc['refresh_token'], $uid]);
    return $acc['access_token'];
}

function spotify_forget(int $uid): void
{
    q('DELETE FROM spotify_accounts WHERE user_id = ?', [$uid]);
}

/** A Spotify link or URI ("https://open.spotify.com/intl-de/playlist/…?si=…", "spotify:album:…") as [type, id], or null. */
function spotify_parse_link(string $link): ?array
{
    $link = trim($link);
    if (preg_match('~^spotify:(playlist|album|track|artist|episode|show):([A-Za-z0-9]{10,40})$~', $link, $m)) return [$m[1], $m[2]];
    if (preg_match('~^https?://open\.spotify\.com/(?:intl-[a-z-]+/)?(?:embed/)?(playlist|album|track|artist|episode|show)/([A-Za-z0-9]{10,40})~', $link, $m)) return [$m[1], $m[2]];
    return null;
}

/** Ready-made study playlists (Spotify's own), shown before someone picks anything. */
const MUSIC_PRESETS = [
    ['lofi beats', '37i9dQZF1DWWQRwui0ExPn'],
    ['Deep Focus', '37i9dQZF1DWZeKCadgRdKQ'],
    ['Peaceful Piano', '37i9dQZF1DX4sWSpwq3LiO'],
    ['Intense Studying', '37i9dQZF1DX8NTLI2TtZa6'],
];
