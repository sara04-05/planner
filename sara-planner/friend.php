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
$shared = $p ? can_see_day($id, $uid) : false;
if (!$p || (!$self && friendship($uid, $id) !== 'friends' && !$shared)) {
    http_response_code(403);
    app_top('Not friends', ['active' => 'explore', 'eyebrow' => 'Your notebook', 'h1' => 'Not friends yet']); ?>
    <p class="auth-sub">You can see someone's day once you're friends. Send them a friend request on the People page.</p>
    <p class="auth-alt"><a class="btn" href="explore.php">Go to Explore</a></p>
<?php
    app_bottom();
    exit;
}

$today = date('Y-m-d');
$plan = $shared ? day_schedule($id, $today) : [];
$now = (int)date('G') * 60 + (int)date('i');

$acts = $self ? '<a class="btn" href="index.php?tab=profile">← My profile</a>' : '<a class="btn" href="explore.php">← Explore</a>';
if ($ns = public_slug($p['id'], $uid)) $acts .= ' <a class="btn" href="u.php?u=' . h($ns) . '">Notebooks</a>';
if (!$self) $acts .= ' <a class="btn" href="hangout.php?with=' . $p['id'] . '">🗓️ Find time together</a> <a class="btn primary" href="messages.php?with=' . $p['id'] . '">Message</a>';
app_top($p['name'], ['active' => 'explore', 'covers' => true, 'eyebrow' => 'Friend\'s notebook', 'h1' => $p['name'], 'actions' => $acts]); ?>
    <div class="friend-day">
      <section>
        <div class="nb-who">
          <?= avatar_html($p, 'lg') ?>
          <div><?= name_html($p) ?><?php if ($p['bio'] !== ''): ?><p class="nb-bio"><?= h($p['bio']) ?></p><?php endif; ?></div>
        </div>
        <div class="eyebrow">Today</div>
        <h2 class="nb-date"><?= h(date('l, j F', strtotime($today))) ?></h2>
        <?php if ($self): ?><p class="hint2">This is exactly what your friends see. Only friends can see it, and you can switch it off in Profile → What others see.</p><?php endif; ?>
        <?php if (!$shared): ?>
          <p class="nb-empty">🔒 <?= h($p['name']) ?> keeps their day private.</p>
        <?php elseif (!$plan): ?>
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
    <form method="post" action="explore.php" class="nb-remove" onsubmit="return confirm((window.SPL_T||String)(this.dataset.q))" data-q="Remove <?= h($p['name']) ?> from your friends?">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="do" value="remove"><input type="hidden" name="id" value="<?= $p['id'] ?>">
      <button class="linkbtn">Remove from friends</button>
    </form>
    <?php endif; ?>
<?php app_bottom();
