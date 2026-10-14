<?php
// A shared notebook: u.php?u=<page name>. Who can see what is decided by the owner in the planner's Profile tab.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';

$viewer = current_user_id();
if ($viewer && !is_verified($viewer)) $viewer = null;
$slug = strtolower(trim((string)($_GET['u'] ?? '')));
$prof = $slug !== '' ? q('SELECT * FROM profiles WHERE slug = ?', [$slug])->fetch() : false;

if (!$prof || !can_view_profile($prof, $viewer)) {
    $needLogin = $prof && (int)$prof['is_public'] === 1 && !$viewer;
    http_response_code($needLogin ? 403 : 404);
    pub_top($needLogin ? 'Log in to see this notebook' : 'Private notebook');
    ?>
  <div class="pub-note">
    <h1 style="font-size:24px;color:var(--ink)"><?= $needLogin ? 'Log in to open this notebook' : 'This notebook is private' ?></h1>
    <p style="margin-top:8px"><?= $needLogin ? 'The owner shares it with people who have an account.' : 'It is either not shared, or the page name is wrong.' ?></p>
    <p style="margin-top:16px">
      <?php if ($needLogin): ?><a class="btn primary" href="login.php">Log in</a> <a class="btn" href="register.php">Create free account</a>
      <?php else: ?><a class="btn" href="people.php">Browse public notebooks</a><?php endif; ?>
    </p>
  </div>
<?php
    pub_bottom();
    exit;
}

$owner = (int)$prof['user_id'];
$user = q('SELECT name FROM users WHERE id = ?', [$owner])->fetch();
$name = (string)($user['name'] ?? '');
$design = profile_design($prof);
$share = profile_share($prof);
$isMe = $viewer === $owner;
$cover = upload_url($design['cover_img'] ? (int)$design['cover_img'] : null);
$state = $viewer && !$isMe ? friendship($viewer, $owner) : 'none';   // friends, sent, received or none (see people.php)
$person = person($owner);
if (!$viewer) $person['avatar_v'] = 0;   // profile pictures are only sent to logged-in people
function friend_btn(string $do, int $id, string $label, string $cls, string $back): string
{
    return '<form method="post" action="people.php" class="inline"><input type="hidden" name="csrf" value="' . h(csrf_token()) . '"><input type="hidden" name="do" value="' . $do . '"><input type="hidden" name="id" value="' . $id . '"><input type="hidden" name="back" value="' . h($back) . '"><button class="' . $cls . '">' . h($label) . '</button></form>';
}
$posts = !empty($share['blog']) ? load_posts($owner, true, $viewer) : [];
$lists = !empty($share['interests']) ? load_lists($owner, true) : [];

$timetable = [];
if (!empty($share['timetable'])) {
    foreach (q('SELECT weekday, hour, text FROM weekly_hours WHERE user_id = ? AND text <> \'\' ORDER BY weekday, hour', [$owner])->fetchAll() as $r) {
        $timetable[(int)$r['weekday']][] = sprintf('%02d:00', $r['hour']) . ' ' . $r['text'];
    }
}
$subjects = [];
if (!empty($share['subjects'])) {
    foreach (q('SELECT id, name FROM subjects WHERE user_id = ? ORDER BY id', [$owner])->fetchAll() as $s) {
        $c = q('SELECT COUNT(*) n, COALESCE(SUM(done), 0) d FROM chapters WHERE subject_id = ?', [$s['id']])->fetch();
        $subjects[] = ['name' => $s['name'], 'pct' => (int)$c['n'] ? (int)round(100 * $c['d'] / $c['n']) : 0, 'n' => (int)$c['n']];
    }
}

pub_top($name . "'s notebook", $design, $viewer);
$WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
?>
  <?php if ($isMe): ?>
    <div class="xcard" style="margin-bottom:16px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <span class="hint2" style="font-size:13px">This is how <?= (int)$prof['is_public'] ? ((int)$prof['guest_view'] ? 'everyone, even visitors without an account,' : 'people with an account') : 'nobody but you' ?> sees your notebook.
      <?= (int)$prof['is_public'] ? '' : 'It is private right now. Turn on “Public profile” in your planner’s Profile tab.' ?></span>
      <a class="btn sm" href="index.php">Edit in my planner</a>
    </div>
  <?php endif; ?>
  <div class="nb-hero">
    <?= banner_html($design, $cover) ?>
    <div class="nb-page"<?= design_attrs($design, 'page') ?>>
      <div class="who">
        <?= avatar_html($person, 'lg') ?>
        <div style="min-width:0;flex:1">
          <h2 translate="no"><?= h($name) ?></h2>
          <div class="hint2">@<?= h($prof['slug']) ?></div>
        </div>
        <?php $back = 'u.php?u=' . $prof['slug']; ?>
        <?php if ($viewer && !$isMe): ?>
          <?php if ($state === 'friends'): ?>
            <a class="btn primary" href="messages.php?with=<?= $owner ?>">Message</a>
            <a class="btn" href="friend.php?id=<?= $owner ?>">Today's plan</a>
          <?php elseif ($state === 'sent'): ?><?= friend_btn('cancel', $owner, 'Requested · cancel', 'btn ghost', $back) ?>
          <?php elseif ($state === 'received'): ?><?= friend_btn('accept', $owner, 'Accept friend request', 'btn primary', $back) ?>
          <?php else: ?><?= friend_btn('add', $owner, 'Add friend', 'btn primary', $back) ?><?php endif; ?>
        <?php elseif (!$viewer): ?>
          <a class="btn primary" href="login.php">Log in to add friend</a>
        <?php endif; ?>
      </div>
      <?php if ($prof['bio'] !== ''): ?><p class="bio" translate="no"><?= nl2br(h($prof['bio'])) ?></p><?php endif; ?>
    </div>
  </div>

  <div<?= design_attrs($design, 'page') ?> style="background:none">
  <?php if ($posts): ?>
    <section class="nb-sec"><h2>✍️ Blog</h2>
      <?php foreach ($posts as $p): ?>
        <article class="post" data-pid="<?= $p['id'] ?>">
          <?php if ($p['image']): ?><img class="pimg" src="<?= h($p['image']) ?>" alt=""><?php endif; ?>
          <div class="pb" translate="no">
            <h3><?= h($p['title']) ?></h3>
            <div class="meta2"><?= h($p['date']) ?></div>
            <div class="txt"><?= h($p['body']) ?></div>
            <div class="acts">
              <?php if ($viewer): ?>
                <button class="likebtn<?= $p['liked'] ? ' on' : '' ?>" data-like="<?= $p['id'] ?>">♥ <span><?= $p['likes'] ?></span></button>
              <?php else: ?>
                <span class="hint2">♥ <?= $p['likes'] ?> · <a href="login.php">Log in</a> to like</span>
              <?php endif; ?>
            </div>
          </div>
        </article>
      <?php endforeach; ?>
    </section>
  <?php endif; ?>

  <?php if ($lists): ?>
    <section class="nb-sec"><h2>⭐ Interests</h2>
      <div class="ilists">
      <?php foreach ($lists as $l): ?>
        <div class="ilist" translate="no">
          <div class="ih"><span class="em"><?= h($l['emoji']) ?></span><h3><?= h($l['title']) ?></h3></div>
          <?php if ($l['layout'] === 'grid'): ?>
            <div class="igrid">
              <?php foreach ($l['items'] as $it): ?>
                <div class="gi"><?php if ($it['image']): ?><img src="<?= h($it['image']) ?>" alt="<?= h($it['text']) ?>" loading="lazy"><?php else: ?><div class="noimg">🖼️</div><?php endif; ?><span class="cap"><?= h($it['text']) ?></span></div>
              <?php endforeach; ?>
            </div>
          <?php else: ?>
            <ul>
              <?php foreach ($l['items'] as $it): ?>
                <li><?php if ($it['image']): ?><img src="<?= h($it['image']) ?>" alt="" loading="lazy"><?php endif; ?><div class="tx"><?= h($it['text']) ?><?php if ($it['note'] !== ''): ?><small><?= h($it['note']) ?></small><?php endif; ?></div></li>
              <?php endforeach; ?>
            </ul>
          <?php endif; ?>
          <?php if (!$l['items']): ?><p class="hint2">Nothing here yet.</p><?php endif; ?>
        </div>
      <?php endforeach; ?>
      </div>
    </section>
  <?php endif; ?>

  <?php if ($timetable): ?>
    <section class="nb-sec"><h2>🗓️ Weekly timetable</h2>
      <div style="overflow:auto"><table class="tt"><thead><tr><?php foreach ($WD as $w): ?><th><?= $w ?></th><?php endforeach; ?></tr></thead>
        <tbody><tr>
          <?php for ($d = 0; $d < 7; $d++): ?><td translate="no"><?= isset($timetable[$d]) ? implode('<br>', array_map('h', $timetable[$d])) : '' ?></td><?php endfor; ?>
        </tr></tbody></table></div>
    </section>
  <?php endif; ?>

  <?php if ($subjects): ?>
    <section class="nb-sec"><h2>📚 Studying</h2>
      <div class="xcard">
      <?php foreach ($subjects as $s): ?>
        <div class="subj-row"><b style="min-width:120px" translate="no"><?= h($s['name']) ?></b><div class="bar"><i style="width:<?= $s['pct'] ?>%"></i></div><span class="hint2"><?= $s['pct'] ?>% of <?= $s['n'] ?> chapter<?= $s['n'] === 1 ? '' : 's' ?></span></div>
      <?php endforeach; ?>
      </div>
    </section>
  <?php endif; ?>

  <?php if (!$posts && !$lists && !$timetable && !$subjects): ?>
    <div class="pub-note">Nothing is shared here yet.</div>
  <?php endif; ?>
  </div>

<script>
(function(){
  var csrf=(document.querySelector('meta[name="csrf-token"]')||{}).content||'';
  function call(action,data){return fetch('api.php?action='+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(data)}).then(function(r){return r.json().then(function(b){if(!r.ok)throw new Error(b.error||'Something went wrong.');return b})})}
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-like]');if(!b)return;
    call('x.like',{post_id:+b.dataset.like}).then(function(r){b.classList.toggle('on',r.liked);b.querySelector('span').textContent=r.likes}).catch(function(e){alert(e.message)});
  });
})();
</script>
<?php pub_bottom();
