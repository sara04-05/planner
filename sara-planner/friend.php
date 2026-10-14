<?php
// A friend's notebook: their name, picture, bio and hour-by-hour plan for today. Nothing else of their planner is shown.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';

$uid = require_login();
$id = isset($_GET['id']) && ctype_digit((string)$_GET['id']) ? (int)$_GET['id'] : 0;
$p = $id ? person($id) : null;
$self = $id === $uid;
if (!$p || (!$self && friendship($uid, $id) !== 'friends')) {
    http_response_code(403);
    auth_top('Not friends'); ?>
    <h1>Not friends yet</h1>
    <p class="auth-sub">You can see someone's day once you're friends. Send them a friend request on the People page.</p>
    <p class="auth-alt"><a href="people.php">Go to People</a></p>
<?php
    auth_bottom();
    exit;
}

$today = date('Y-m-d');
$plan = day_schedule($id, $today);
$now = (int)date('G') * 60 + (int)date('i');

auth_top($p['name'], 'wide notebook-card', true); ?>
    <div class="admin-top">
      <a class="btn" href="people.php">← People</a>
      <span class="grow"></span>
      <?php if ($ns = public_slug($p['id'])): ?><a class="btn" href="u.php?u=<?= h($ns) ?>">Blog &amp; interests</a><?php endif; ?>
      <?php if (!$self): ?><a class="btn primary" href="messages.php?with=<?= $p['id'] ?>">Message</a><?php endif; ?>
    </div>
    <div class="nb-open">
      <aside class="nb-front"><?= cover_html($p) ?></aside>
      <section class="nb-page">
        <div class="nb-who">
          <?= avatar_html($p, 'lg') ?>
          <div><?= name_html($p) ?><?php if ($p['bio'] !== ''): ?><p class="nb-bio"><?= h($p['bio']) ?></p><?php endif; ?></div>
        </div>
        <div class="eyebrow">Today</div>
        <h2 class="nb-date"><?= h(date('l, j F', strtotime($today))) ?></h2>
        <?php if (!$plan): ?>
          <p class="nb-empty">Nothing planned today.</p>
        <?php else: ?>
        <ol class="nb-plan">
          <?php foreach ($plan as $e): $type = isset(HOUR_COLORS[$e['type']]) ? $e['type'] : 'personal'; ?>
            <li class="<?= $now >= $e['from'] && $now < $e['to'] ? 'now' : ($now >= $e['to'] ? 'past' : '') ?>" style="--hc:var(--c-<?= HOUR_COLORS[$type] ?>)">
              <span class="nb-time"><?= hm($e['from']) ?>–<?= hm(min($e['to'], 1440)) ?></span>
              <span class="nb-mark"></span>
              <span class="nb-what" translate="no"><?= h($e['text']) ?></span>
              <span class="nb-type"><?= h(HOUR_NAMES[$type]) ?></span>
            </li>
          <?php endforeach; ?>
        </ol>
        <?php endif; ?>
      </section>
    </div>
    <?php if (!$self): ?>
    <form method="post" action="people.php" class="nb-remove" onsubmit="return confirm((window.SPL_T||String)(this.dataset.q))" data-q="Remove <?= h($p['name']) ?> from your friends?">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="do" value="remove"><input type="hidden" name="id" value="<?= $p['id'] ?>">
      <button class="linkbtn">Remove from friends</button>
    </form>
    <?php endif; ?>
<?php auth_bottom();
