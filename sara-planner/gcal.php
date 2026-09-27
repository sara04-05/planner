<?php
// Google Calendar sync: puts the "Hour by hour" plan into a "Splanner" calendar in the user's Google account.
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in config.php (see README).
declare(strict_types=1);

const GCAL_SCOPE  = 'openid email https://www.googleapis.com/auth/calendar.app.created';
const GCAL_API    = 'https://www.googleapis.com/calendar/v3';
const GCAL_WINDOW = 14;   // days from today that are kept in sync, so weekly hours show up ahead of time

// Google Calendar colour ids for each hour type
const GCAL_COLORS = ['uni' => '9', 'work' => '6', 'study' => '2', 'personal' => '5', 'health' => '10', 'sleep' => '8'];
const GCAL_LABELS = ['uni' => 'Uni', 'work' => 'Work', 'study' => 'Study', 'personal' => 'Personal', 'health' => 'Health', 'sleep' => 'Sleep'];

function gcal_configured(): bool
{
    return defined('GOOGLE_CLIENT_ID') && GOOGLE_CLIENT_ID !== '' && defined('GOOGLE_CLIENT_SECRET') && GOOGLE_CLIENT_SECRET !== '';
}

/** The address Google sends people back to. Must be listed in the Google Cloud console exactly like this. */
function gcal_redirect_uri(): string
{
    if (defined('GOOGLE_REDIRECT_URI') && GOOGLE_REDIRECT_URI !== '') return GOOGLE_REDIRECT_URI;
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir . '/calendar.php';
}

/** A small HTTP client. Returns [status code, decoded JSON body]. */
function gcal_http(string $method, string $url, ?array $json = null, ?array $form = null, ?string $token = null): array
{
    $headers = ['Accept: application/json'];
    if ($token) $headers[] = 'Authorization: Bearer ' . $token;
    $body = null;
    if ($json !== null) { $body = json_encode($json); $headers[] = 'Content-Type: application/json'; }
    if ($form !== null) { $body = http_build_query($form); $headers[] = 'Content-Type: application/x-www-form-urlencoded'; }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 20,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        throw new RuntimeException("Couldn't reach Google ($err).");
    }
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    return [$status, json_decode((string)$raw, true) ?: []];
}

function gcal_account(int $uid): ?array
{
    try {
        return q('SELECT * FROM google_accounts WHERE user_id = ?', [$uid])->fetch() ?: null;
    } catch (PDOException $e) {
        return null;
    }
}

/** A working access token, refreshed when the old one ran out. */
function gcal_token(int $uid, array &$acc): string
{
    if ($acc['access_token'] && (int)$acc['expires_at'] > time() + 60) return $acc['access_token'];
    [$st, $r] = gcal_http('POST', 'https://oauth2.googleapis.com/token', null, [
        'client_id' => GOOGLE_CLIENT_ID, 'client_secret' => GOOGLE_CLIENT_SECRET,
        'refresh_token' => $acc['refresh_token'], 'grant_type' => 'refresh_token',
    ]);
    if ($st !== 200 || empty($r['access_token'])) {
        if (($r['error'] ?? '') === 'invalid_grant') {
            gcal_forget($uid);   // access was removed in the Google account
            throw new RuntimeException('Google Calendar was disconnected. Connect it again to keep syncing.');
        }
        throw new RuntimeException("Google didn't accept the login. Try again in a minute.");
    }
    $acc['access_token'] = $r['access_token'];
    $acc['expires_at'] = time() + (int)($r['expires_in'] ?? 3600);
    q('UPDATE google_accounts SET access_token = ?, expires_at = ? WHERE user_id = ?', [$acc['access_token'], $acc['expires_at'], $uid]);
    return $acc['access_token'];
}

/** The "Splanner" calendar, created the first time it's needed (or again if it was deleted in Google). */
function gcal_calendar(int $uid, array &$acc, bool $fresh = false): string
{
    if ($acc['calendar_id'] && !$fresh) return $acc['calendar_id'];
    [$st, $r] = gcal_http('POST', GCAL_API . '/calendars',
        ['summary' => 'Splanner', 'description' => 'Your hour-by-hour plan from Splanner', 'timeZone' => date_default_timezone_get()],
        null, gcal_token($uid, $acc));
    if ($st !== 200 || empty($r['id'])) throw new RuntimeException("Couldn't create the Splanner calendar in Google.");
    $acc['calendar_id'] = $r['id'];
    q('UPDATE google_accounts SET calendar_id = ? WHERE user_id = ?', [$r['id'], $uid]);
    q('DELETE FROM gcal_events WHERE user_id = ?', [$uid]);
    return $r['id'];
}

function gcal_forget(int $uid): void
{
    q('DELETE FROM gcal_events WHERE user_id = ?', [$uid]);
    q('DELETE FROM google_accounts WHERE user_id = ?', [$uid]);
}

/** The plan for one date as events: an hour's own entry wins over the weekly one, and neighbouring hours with the same text become one event. */
function gcal_day_events(int $uid, string $date): array
{
    $wd = ((int)date('N', strtotime($date))) - 1;
    $plan = [];
    foreach (q('SELECT hour, text, type, start_min, end_min FROM weekly_hours WHERE user_id = ? AND weekday = ?', [$uid, $wd]) as $r) $plan[(int)$r['hour']] = $r;
    foreach (q('SELECT hour, text, type, start_min, end_min FROM hours WHERE user_id = ? AND date = ?', [$uid, $date]) as $r) $plan[(int)$r['hour']] = $r;
    ksort($plan);

    $events = [];
    $last = null;
    foreach ($plan as $h => $r) {
        $text = trim($r['text']);
        if ($text === '') { $last = null; continue; }
        $from = $h * 60 + (int)$r['start_min'];
        $to   = $h * 60 + (int)$r['end_min'];
        if ($last !== null && $events[$last]['to'] === $from && $events[$last]['title'] === $text && $events[$last]['type'] === $r['type']) {
            $events[$last]['to'] = $to;
        } else {
            $events[] = ['from' => $from, 'to' => $to, 'title' => $text, 'type' => $r['type']];
            $last = array_key_last($events);
        }
    }
    return $events;
}

function gcal_time(string $date, int $min): array
{
    $d = new DateTime($date . ' 00:00:00');
    $d->modify("+$min minutes");
    return ['dateTime' => $d->format('Y-m-d\TH:i:s'), 'timeZone' => date_default_timezone_get()];
}

/** Make Google match the planner for these dates. Only changed hours are sent. Returns how many events were added or removed. */
function gcal_sync_dates(int $uid, array $dates, bool $retried = false): int
{
    $acc = gcal_account($uid);
    if (!$acc) throw new RuntimeException('Google Calendar is not connected.');
    $cal = gcal_calendar($uid, $acc);
    $changes = 0;

    foreach ($dates as $date) {
        $want = [];
        foreach (gcal_day_events($uid, $date) as $e) {
            $want[sha1(json_encode([$e['from'], $e['to'], $e['type'], $e['title']]))][] = $e;
        }
        foreach (q('SELECT event_id, sig FROM gcal_events WHERE user_id = ? AND date = ?', [$uid, $date])->fetchAll() as $row) {
            if (!empty($want[$row['sig']])) { array_pop($want[$row['sig']]); continue; }   // already in Google
            [$st] = gcal_http('DELETE', GCAL_API . '/calendars/' . rawurlencode($cal) . '/events/' . rawurlencode($row['event_id']), null, null, gcal_token($uid, $acc));
            if ($st >= 300 && $st !== 404 && $st !== 410) throw new RuntimeException("Couldn't remove an old hour from Google Calendar.");
            q('DELETE FROM gcal_events WHERE user_id = ? AND event_id = ?', [$uid, $row['event_id']]);
            $changes++;
        }
        foreach ($want as $sig => $list) {
            foreach ($list as $e) {
                $event = [
                    'summary'     => $e['title'],
                    'description' => (GCAL_LABELS[$e['type']] ?? 'Plan') . ' · planned in Splanner',
                    'start'       => gcal_time($date, $e['from']),
                    'end'         => gcal_time($date, $e['to']),
                    'colorId'     => GCAL_COLORS[$e['type']] ?? '5',
                    'reminders'   => ['useDefault' => false],
                ];
                [$st, $r] = gcal_http('POST', GCAL_API . '/calendars/' . rawurlencode($cal) . '/events', $event, null, gcal_token($uid, $acc));
                if ($st === 404 && !$retried) {   // the Splanner calendar was deleted in Google: make a new one, once
                    gcal_calendar($uid, $acc, true);
                    return $changes + gcal_sync_dates($uid, $dates, true);
                }
                if ($st !== 200 || empty($r['id'])) throw new RuntimeException("Couldn't add \"{$e['title']}\" to Google Calendar.");
                q('INSERT INTO gcal_events (user_id, date, event_id, sig) VALUES (?, ?, ?, ?)', [$uid, $date, $r['id'], $sig]);
                $changes++;
            }
        }
    }
    return $changes;
}

/** Today and the next days (GCAL_WINDOW), the part of the plan that is always kept in Google. */
function gcal_window(): array
{
    $out = [];
    for ($i = 0; $i < GCAL_WINDOW; $i++) $out[] = date('Y-m-d', strtotime("+$i days"));
    return $out;
}
