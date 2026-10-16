<?php
// Hang out: when you and a friend are both free. Uses both daily plans, shows only the free time, never what anyone is doing.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';

$uid = require_login();
$with = isset($_GET['with']) && ctype_digit((string)$_GET['with']) ? (int)$_GET['with'] : 0;
$friend = $with ? person($with) : null;
if ($friend && friendship($uid, $with) !== 'friends') $friend = null;

if (!$friend) {   // pick a friend
    app_top('Hang out', ['active' => 'explore', 'eyebrow' => 'Your notebook', 'h1' => 'Hang out', 'actions' => '<a class="btn" href="index.php?tab=profile">← My profile</a>']);
    $ids = friend_ids($uid); ?>
    <p class="auth-sub">Pick a friend to see when you are both free.</p>
    <?php if (!$ids): ?><p class="empty">No friends yet. Find people in <a href="explore.php">Explore</a>.</p>
    <?php else: ?><ul class="userlist"><?php foreach ($ids as $fid): $f = person($fid); if (!$f) continue; ?>
      <li><a class="ulink" href="hangout.php?with=<?= $fid ?>"><?= avatar_html($f, '') ?><span class="un" translate="no"><?= h($f['name']) ?></span></a></li>
    <?php endforeach; ?></ul><?php endif;
    app_bottom();
    exit;
}

$days = [];
for ($i = 0; $i < 7; $i++) $days[] = date('Y-m-d', strtotime("+$i day"));
$date = in_array($_GET['date'] ?? '', $days, true) ? $_GET['date'] : $days[0];
$today = $date === $days[0];
$after = $today ? (int)ceil(((int)date('G') * 60 + (int)date('i')) / 15) * 15 : 0;
$theirs = can_see_day($with, $uid);   // you only see their free time if they share their day with you
$mine = free_slots($uid, $date, $after);
$them = $theirs ? free_slots($with, $date, $after) : [];
$both = $theirs ? common_slots($mine, $them) : [];

$bar = function (array $slots, string $cls): string {
    $span = FREE_TO - FREE_FROM;
    $o = '<div class="ho-bar">';
    foreach ($slots as [$a, $b]) $o .= '<i class="' . $cls . '" style="left:' . round(($a - FREE_FROM) / $span * 100, 2) . '%;width:' . round(($b - $a) / $span * 100, 2) . '%"></i>';
    return $o . '</div>';
};
app_top('Hang out with ' . $friend['name'], ['active' => 'explore', 'eyebrow' => 'Hang out', 'h1' => 'Free time with ' . $friend['name'],
    'actions' => '<a class="btn" href="hangout.php">← Friends</a> <a class="btn primary" href="messages.php?with=' . $with . '">Message</a>']); ?>
    <nav class="ho-days" aria-label="Day">
      <?php foreach ($days as $d): ?><a class="chipbtn<?= $d === $date ? ' on' : '' ?>" href="hangout.php?with=<?= $with ?>&amp;date=<?= $d ?>"><?= $d === $days[0] ? 'Today' : h(date('D j', strtotime($d))) ?></a><?php endforeach; ?>
    </nav>
    <h2 class="nb-date"><?= h(date('l, j F', strtotime($date))) ?></h2>
    <?php if (!$theirs): ?>
      <p class="nb-empty">🔒 <?= h($friend['name']) ?> doesn't share their day, so there is nothing to compare.</p>
    <?php else: ?>
      <div class="ho-chart" aria-hidden="true">
        <div class="ho-row"><span>You</span><?= $bar($mine, 'me') ?></div>
        <div class="ho-row"><span translate="no"><?= h($friend['name']) ?></span><?= $bar($them, 'fr') ?></div>
        <div class="ho-row"><span>Both</span><?= $bar($both, 'both') ?></div>
        <div class="ho-axis"><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>23:00</span></div>
      </div>
      <?php if (!$both): ?><p class="nb-empty">No shared free time of 30 minutes or more on this day. Try another day above.</p>
      <?php else: ?>
        <h3 class="nb-h2">You are both free</h3>
        <ul class="ho-list">
          <?php foreach ($both as [$a, $b]): ?><li><b><?= hm($a) ?>–<?= hm($b) ?></b><span><?= intdiv($b - $a, 60) ? intdiv($b - $a, 60) . ' h ' : '' ?><?= ($b - $a) % 60 ? ($b - $a) % 60 . ' min' : '' ?></span>
            <a class="btn sm" href="messages.php?with=<?= $with ?>">Suggest it</a></li><?php endforeach; ?>
        </ul>
      <?php endif; ?>
      <p class="hint2">Only free time is compared, from 08:00 to 23:00. Nobody sees what the other has planned.</p>
    <?php endif; ?>
<?php app_bottom();
