<?php
// What's new on the website. Everything listed here arrives in every user's bell (the notifications button) once.
// To tell everybody about something new, add a line at the bottom: the next number, today's date, the message and the page it opens.
// People who sign up later do not get the older ones (an entry dated before their sign-up day is skipped).
declare(strict_types=1);

const SITE_NEWS = [
    ['id' => 1, 'at' => '2026-10-23', 'text' => 'New: every Study subject now has its own notebook in Notes, with a place for each chapter.', 'link' => 'notes.php'],
];

/** Puts the site news this person has not been told about yet into their bell. Cheap when there is nothing new. */
function deliver_site_news(int $uid): void
{
    try {
        $p = q('SELECT news_seen FROM profiles WHERE user_id = ?', [$uid])->fetch();
        if (!$p) return;   // no profile yet: it is created (and this runs) on their next page
        $seen = (int)$p['news_seen'];
        $latest = max(array_column(SITE_NEWS, 'id'));
        if ($seen >= $latest) return;
        q('UPDATE profiles SET news_seen = ? WHERE user_id = ?', [$latest, $uid]);   // first, so a second request can't deliver twice
        $joined = substr((string)(q('SELECT created_at FROM users WHERE id = ?', [$uid])->fetch()['created_at'] ?? ''), 0, 10);
        foreach (SITE_NEWS as $n) {
            if ($n['id'] <= $seen || ($joined !== '' && $n['at'] < $joined)) continue;
            notify($uid, 'news:' . $n['id'], $n['text'], $n['link']);
        }
    } catch (PDOException $e) {
        // the news column could not be added on this host: no site news, everything else works
    }
}
