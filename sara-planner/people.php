<?php
// People: find other users by name, send and answer friend requests, and see your friends as notebooks.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';

$uid = require_login();
$msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $other = isset($_POST['id']) && ctype_digit((string)$_POST['id']) ? (int)$_POST['id'] : 0;
    $do = (string)($_POST['do'] ?? '');
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $msg = 'Your session expired. Please try again.';
    } elseif ($other && $other !== $uid && person($other)) {
        $state = friendship($uid, $other);
        if ($do === 'add' && $state === 'none') {
            q('INSERT INTO friends (from_id, to_id, accepted, sent_at) VALUES (?, ?, 0, ?)', [$uid, $other, time()]);
        } elseif (($do === 'add' || $do === 'accept') && $state === 'received') {
            q('UPDATE friends SET accepted = 1 WHERE from_id = ? AND to_id = ?', [$other, $uid]);
        } elseif (in_array($do, ['decline', 'cancel', 'remove'], true)) {
            q('DELETE FROM friends WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)', [$uid, $other, $other, $uid]);
        }
    }
    if (!$msg) {
        $back = (string)($_POST['back'] ?? '');
        header('Location: ' . (preg_match('/^(people|friend|u)\.php(\?[\w=&%.+-]*)?$/', $back) ? $back : 'people.php'));
        exit;
    }
}

$me = person($uid);
$requests = array_filter(array_map(fn($r) => person((int)$r['from_id']),
    q('SELECT from_id FROM friends WHERE to_id = ? AND accepted = 0 ORDER BY sent_at DESC', [$uid])->fetchAll()));
$friends = array_filter(array_map('person', friend_ids($uid)));
usort($friends, fn($a, $b) => strcasecmp($a['name'], $b['name']));

// Search by name (part of it) or by exact email
$find = trim((string)($_GET['q'] ?? ''));
$found = [];
if (mb_strlen($find) >= 2) {
    $like = '%' . strtr(mb_strtolower($find), ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
    $rows = q("SELECT id FROM users WHERE id <> ? AND (LOWER(name) LIKE ? ESCAPE '!' OR LOWER(email) = ?) ORDER BY name LIMIT 30",
        [$uid, $like, mb_strtolower($find)])->fetchAll();
    $found = array_filter(array_map(fn($r) => person((int)$r['id']), $rows));
}

/** One small form button that posts an action about a person. */
function act(string $do, int $id, string $label, string $cls = 'btn', string $back = ''): string
{
    return '<form method="post" class="inline"><input type="hidden" name="csrf" value="' . h(csrf_token()) . '">'
        . '<input type="hidden" name="do" value="' . $do . '"><input type="hidden" name="id" value="' . $id . '">'
        . ($back ? '<input type="hidden" name="back" value="' . h($back) . '">' : '')
        . '<button class="' . $cls . '">' . h($label) . '</button></form>';
}

// Public notebooks of other people (never yours)
$pubRows = [];
foreach (q('SELECT p.*, u.name FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.is_public = 1 AND p.slug IS NOT NULL AND p.user_id <> ? ORDER BY u.name LIMIT 24', [$uid])->fetchAll() as $r) {
    $r['nbs'] = load_notebooks((int)$r['user_id'], true);
    if ($r['nbs']) $pubRows[] = $r;
    if (count($pubRows) >= 6) break;
}

app_top('People', ['active' => 'people', 'covers' => true, 'eyebrow' => 'Your notebook', 'h1' => 'People',
    'actions' => '<a class="btn" href="explore.php">Explore notebooks</a>']); ?>
    <div class="me-card">
      <?= avatar_html($me, 'lg') ?>
      <div class="grow">
        <div class="me-name"><?= name_html($me) ?></div>
        <p class="me-bio"><?= $me['bio'] !== '' ? h($me['bio']) : '<span class="muted">No bio yet.</span>' ?></p>
      </div>
      <a class="btn" href="index.php?tab=profile">My profile</a>
    </div>

    <?php if ($requests): ?>
    <section class="ppl-sec">
      <h2>Friend requests</h2>
      <ul class="ppl-list">
        <?php foreach ($requests as $p): ?>
          <li><?= avatar_html($p) ?><div class="grow"><?= name_html($p) ?><?php if ($p['bio'] !== ''): ?><span class="pbio"><?= h($p['bio']) ?></span><?php endif; ?></div>
            <?= act('accept', $p['id'], 'Accept', 'btn primary') ?><?= act('decline', $p['id'], 'Decline', 'btn ghost') ?></li>
        <?php endforeach; ?>
      </ul>
    </section>
    <?php endif; ?>

    <section class="ppl-sec">
      <h2>Your friends</h2>
      <p class="auth-sub">Open a notebook to see that friend's plan for today.</p>
      <div class="shelf">
        <a class="nb-new" href="#find"><span>+</span>Add a friend</a>
        <?php foreach ($friends as $p): ?>
          <a class="nb" href="friend.php?id=<?= $p['id'] ?>">
            <?= cover_html($p) ?>
            <span class="nb-title"><?= h($p['name']) ?></span>
            <?php if ($p['same_name']): ?><span class="nb-sub" translate="no"><?= h($p['email']) ?></span><?php endif; ?>
          </a>
        <?php endforeach; ?>
      </div>
    </section>

    <section class="ppl-sec">
      <h2>Public notebooks</h2>
      <p class="auth-sub">Notebooks that people chose to share. <a href="explore.php">See all</a></p>
      <?php if (!$pubRows): ?><p class="chat-empty">Nobody else has shared a notebook yet.</p>
      <?php else: ?><div class="people"><?php foreach ($pubRows as $r) echo person_card($r, $r['nbs']); ?></div><?php endif; ?>
    </section>

    <section class="ppl-sec" id="find">
      <h2>Find people</h2>
      <form method="get" class="chat-row find-row" action="people.php#find">
        <input name="q" value="<?= h($find) ?>" placeholder="Name or email" aria-label="Name or email" minlength="2" required>
        <button class="btn primary">Search</button>
      </form>
      <?php if ($find !== '' && !$found): ?><p class="chat-empty">Nobody found. Check the spelling, or search by their email.</p><?php endif; ?>
      <?php if ($found): ?>
      <ul class="ppl-list">
        <?php foreach ($found as $p): $st = friendship($uid, $p['id']); $back = 'people.php?q=' . rawurlencode($find); ?>
          <li><?= avatar_html($p) ?><div class="grow"><?= name_html($p) ?><?php if ($p['bio'] !== ''): ?><span class="pbio"><?= h($p['bio']) ?></span><?php endif; ?></div>
            <?php if ($ns = public_slug($p['id'])): ?><a class="btn ghost" href="u.php?u=<?= h($ns) ?>">Notebook</a><?php endif; ?>
            <?php if ($st === 'friends'): ?><a class="btn" href="friend.php?id=<?= $p['id'] ?>">Friends ✓</a>
            <?php elseif ($st === 'sent'): ?><?= act('cancel', $p['id'], 'Requested · cancel', 'btn ghost', $back) ?>
            <?php elseif ($st === 'received'): ?><?= act('accept', $p['id'], 'Accept', 'btn primary', $back) ?>
            <?php else: ?><?= act('add', $p['id'], 'Add friend', 'btn primary', $back) ?><?php endif; ?></li>
        <?php endforeach; ?>
      </ul>
      <?php endif; ?>
    </section>
<?php app_bottom();
