<?php
// Explore: everyone who has an account, shown as a name and nothing else. You have to be logged in to look.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';

$viewer = current_user_id();
if ($viewer && !is_verified($viewer)) $viewer = null;

if (!$viewer) {   // visitors can look around, but only at notebooks whose owners made them visible without logging in
    $term = trim((string)($_GET['q'] ?? ''));
    $people = guest_people(60, $term);
    app_top('Explore', ['active' => 'explore', 'covers' => true, 'eyebrow' => 'Look inside', 'h1' => 'Explore']); ?>
  <p class="auth-sub">You are looking as a visitor. You can read the notebooks that people chose to show to everyone. To add friends, like, message or make your own, <a href="register.php">create a free account</a> or <a href="login.php">log in</a>.</p>
  <form class="searchbar" method="get" action="explore.php">
    <input type="search" name="q" value="<?= h($term) ?>" placeholder="Search by name" aria-label="Search people">
    <button class="btn primary">Search</button>
  </form>
  <?php if (!$people): ?>
    <div class="pub-note"><?= $term !== '' ? 'Nobody matches that search.' : 'Nobody has made a notebook visible to visitors yet.' ?></div>
  <?php else: ?>
    <div class="people"><?php foreach ($people as $r) echo person_card($r, $r['nbs']); ?></div>
  <?php endif; ?>
<?php
    app_bottom();
    exit;
}

$msg = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {   // friend buttons (here, on profiles and on a friend's page) all post to this page
    $other = isset($_POST['id']) && ctype_digit((string)$_POST['id']) ? (int)$_POST['id'] : 0;
    $do = (string)($_POST['do'] ?? '');
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $msg = 'Your session expired. Please try again.';
    } elseif ($other && $other !== $viewer && person($other)) {
        $state = friendship($viewer, $other);
        $myName = (string)(person($viewer)['name'] ?? 'Someone');
        if ($do === 'add' && $state === 'none') {
            q('INSERT INTO friends (from_id, to_id, accepted, sent_at) VALUES (?, ?, 0, ?)', [$viewer, $other, time()]);
            notify_replace($other, 'friend:' . $viewer, $myName . ' sent you a friend request.', 'explore.php');
        } elseif (($do === 'add' || $do === 'accept') && $state === 'received') {
            q('UPDATE friends SET accepted = 1 WHERE from_id = ? AND to_id = ?', [$other, $viewer]);
            q('DELETE FROM notifications WHERE user_id = ? AND ref = ?', [$viewer, 'friend:' . $other]);   // the request is answered
            notify_replace($other, 'accepted:' . $viewer, $myName . ' accepted your friend request.', 'u.php?id=' . $viewer);
        } elseif (in_array($do, ['decline', 'cancel', 'remove'], true)) {
            q('DELETE FROM friends WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', [$viewer, $other, $other, $viewer]);
            q('DELETE FROM notifications WHERE (user_id = ? AND ref = ?) OR (user_id = ? AND ref = ?)', [$other, 'friend:' . $viewer, $viewer, 'friend:' . $other]);   // a withdrawn or declined request disappears
        }
    }
    if (!$msg) {
        $back = (string)($_POST['back'] ?? '');
        header('Location: ' . (preg_match('/^(explore|friend|u)\.php(\?[\w=&%.+-]*)?$/', $back) ? $back : 'explore.php'));
        exit;
    }
}

/** One small form button that posts an action about a person. */
function act(string $do, int $id, string $label, string $cls, string $back): string
{
    return '<form method="post" class="inline"><input type="hidden" name="csrf" value="' . h(csrf_token()) . '">'
        . '<input type="hidden" name="do" value="' . $do . '"><input type="hidden" name="id" value="' . $id . '">'
        . '<input type="hidden" name="back" value="' . h($back) . '"><button class="' . $cls . '">' . h($label) . '</button></form>';
}

$requests = array_filter(array_map(fn($r) => person((int)$r['from_id']),
    q('SELECT from_id FROM friends WHERE to_id = ? AND accepted = 0 ORDER BY sent_at DESC', [$viewer])->fetchAll()));
$friends = array_filter(array_map('person', friend_ids($viewer)));
usort($friends, fn($a, $b) => strcasecmp($a['name'], $b['name']));

$term = trim((string)($_GET['q'] ?? ''));
// Only people who switched "Show me in Explore" on are listed (everybody else just uses the app), and never you yourself.
$sql = 'SELECT u.id, u.name, p.slug, p.is_public, u.verified_badge, p.cover, p.cover_img, p.words, p.avatar_v FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.email_verified = 1 AND u.id <> ? AND COALESCE(p.in_explore, 0) = 1';
$args = [$viewer];
if ($term !== '') {
    $sql .= " AND u.name LIKE ? ESCAPE '|'";
    $args[] = '%' . str_replace(['|', '%', '_'], ['||', '|%', '|_'], $term) . '%';
}
$rows = q($sql . ' ORDER BY u.name LIMIT 500', $args)->fetchAll();

app_top('Explore', ['active' => 'explore', 'covers' => true, 'eyebrow' => 'Your notebook', 'h1' => 'Explore']);
?>
  <?php if ($msg): ?><div class="formmsg err" role="alert"><?= h($msg) ?></div><?php endif; ?>
  <?php if ($requests): ?>
  <section class="ppl-sec">
    <h2>Friend requests</h2>
    <ul class="ppl-list">
      <?php foreach ($requests as $p): ?>
        <li><?= avatar_html($p) ?><div class="grow"><?= name_html($p) ?></div>
          <?= act('accept', $p['id'], 'Accept', 'btn primary', 'explore.php') ?><?= act('decline', $p['id'], 'Decline', 'btn ghost', 'explore.php') ?></li>
      <?php endforeach; ?>
    </ul>
  </section>
  <?php endif; ?>
  <?php if ($friends): ?>
  <section class="ppl-sec">
    <h2>Your friends</h2>
    <p class="auth-sub">Open a notebook to see that friend's plan for today.</p>
    <div class="shelf">
      <?php foreach ($friends as $p): ?>
        <a class="nb" href="friend.php?id=<?= $p['id'] ?>"><?= cover_html($p) ?><span class="nb-title"><?= h($p['name']) ?></span></a>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>
  <h2 class="nb-h2" style="margin-top:22px">Everyone</h2>
  <p class="hint2" style="font-size:14px;margin:-6px 0 16px"><?= count($rows) ?> <?= count($rows) === 1 ? 'person is' : 'people are' ?> on Splanner<?= $term !== '' ? ' matching your search' : '' ?>.</p>
  <form class="searchbar" method="get" action="explore.php">
    <input type="search" name="q" value="<?= h($term) ?>" placeholder="Search by name" aria-label="Search people">
    <button class="btn primary">Search</button>
  </form>
  <?php if (!$rows): ?>
    <div class="pub-note"><?= $term !== '' ? 'Nobody matches that search.' : 'Nobody has chosen to be listed in Explore yet.' ?></div>
  <?php else: ?>
  <ul class="userlist cards">
    <?php foreach ($rows as $r): ?>
      <?php $isMe = (int)$r['id'] === $viewer; $st = $isMe ? '' : friendship($viewer, (int)$r['id']); $back = 'explore.php' . ($term !== '' ? '?q=' . rawurlencode($term) : ''); ?>
      <?php $href = (int)$r['is_public'] && (string)$r['slug'] !== '' ? 'u.php?u=' . rawurlencode((string)$r['slug']) : 'u.php?id=' . (int)$r['id']; ?>
      <li translate="no"><a class="ulink" href="<?= h($href) ?>"><span class="ucover" aria-hidden="true"><?= cover_html(['cover' => $r['cover'] ?: DEFAULT_COVER, 'cover_img' => $r['cover_img'], 'words' => (string)$r['words'], 'name' => $r['name'], 'avatar_v' => 0, 'id' => (int)$r['id']], true) ?></span><span class="un"><?= h($r['name']) ?><?= vbadge((int)$r['verified_badge'] === 1) ?></span><?php if (!(int)$r['is_public']): ?><small title="Private account">🔒</small><?php endif; ?></a>
        <?php if ($st === 'friends'): ?><span class="hint2">Friends ✓</span>
        <?php elseif ($st === 'sent'): ?><?= act('cancel', (int)$r['id'], 'Requested', 'btn sm ghost', $back) ?>
        <?php elseif ($st === 'received'): ?><?= act('accept', (int)$r['id'], 'Accept', 'btn sm primary', $back) ?>
        <?php elseif (!$isMe): ?><?= act('add', (int)$r['id'], 'Add', 'btn sm primary', $back) ?><?php endif; ?></li>
    <?php endforeach; ?>
  </ul>
  <?php endif; ?>
<?php app_bottom();
