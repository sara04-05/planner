<?php
// Explore: everyone who has an account, shown as a name and nothing else. You have to be logged in to look.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';

$viewer = current_user_id();
if ($viewer && !is_verified($viewer)) $viewer = null;

if (!$viewer) {
    app_top('Explore', ['active' => 'explore', 'eyebrow' => 'Your notebook', 'h1' => 'Explore']); ?>
  <p class="auth-sub">Log in to see who else is on Splanner.</p>
  <p style="margin-top:16px"><a class="btn primary" href="login.php">Log in</a> <a class="btn" href="register.php">Create free account</a></p>
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
        if ($do === 'add' && $state === 'none') {
            q('INSERT INTO friends (from_id, to_id, accepted, sent_at) VALUES (?, ?, 0, ?)', [$viewer, $other, time()]);
        } elseif (($do === 'add' || $do === 'accept') && $state === 'received') {
            q('UPDATE friends SET accepted = 1 WHERE from_id = ? AND to_id = ?', [$other, $viewer]);
        } elseif (in_array($do, ['decline', 'cancel', 'remove'], true)) {
            q('DELETE FROM friends WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', [$viewer, $other, $other, $viewer]);
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
$sql = 'SELECT id, name FROM users WHERE email_verified = 1';
$args = [];
if ($term !== '') {
    $sql .= " AND name LIKE ? ESCAPE '|'";
    $args[] = '%' . str_replace(['|', '%', '_'], ['||', '|%', '|_'], $term) . '%';
}
$rows = q($sql . ' ORDER BY name LIMIT 500', $args)->fetchAll();

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
    <div class="pub-note">Nobody matches that search.</div>
  <?php else: ?>
  <ul class="userlist">
    <?php foreach ($rows as $r): ?>
      <?php $isMe = (int)$r['id'] === $viewer; $st = $isMe ? '' : friendship($viewer, (int)$r['id']); $back = 'explore.php' . ($term !== '' ? '?q=' . rawurlencode($term) : ''); ?>
      <li translate="no"><span class="av" aria-hidden="true"><?= h(mb_strtoupper(mb_substr($r['name'], 0, 1))) ?></span><span class="un"><?= h($r['name']) ?></span>
        <?php if ($st === 'friends'): ?><span class="hint2">Friends ✓</span>
        <?php elseif ($st === 'sent'): ?><?= act('cancel', (int)$r['id'], 'Requested', 'btn sm ghost', $back) ?>
        <?php elseif ($st === 'received'): ?><?= act('accept', (int)$r['id'], 'Accept', 'btn sm primary', $back) ?>
        <?php elseif (!$isMe): ?><?= act('add', (int)$r['id'], 'Add', 'btn sm primary', $back) ?><?php endif; ?></li>
    <?php endforeach; ?>
  </ul>
  <?php endif; ?>
<?php app_bottom();
