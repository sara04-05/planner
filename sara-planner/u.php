<?php
// Someone's profile: u.php?u=<page name>. A profile is just their notebooks. Opening one shows it in the same notebook layout as
// the rest of the site: its own paper, colours and stickers, and its pages (cover, interests, blog…) as the side tabs.
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
    app_top($needLogin ? 'Log in to see this notebook' : 'Private notebook', ['active' => 'explore', 'eyebrow' => 'Your notebook',
        'h1' => $needLogin ? 'Log in to open this notebook' : 'This notebook is private']);
    ?>
  <p class="auth-sub"><?= $needLogin ? 'The owner shares it with people who have an account.' : 'It is either not shared, or the page name is wrong.' ?></p>
  <p style="margin-top:16px">
    <?php if ($needLogin): ?><a class="btn primary" href="login.php">Log in</a> <a class="btn" href="register.php">Create free account</a>
    <?php else: ?><a class="btn" href="explore.php">Browse public notebooks</a><?php endif; ?>
  </p>
<?php
    app_bottom();
    exit;
}

$owner = (int)$prof['user_id'];
$isMe = $viewer === $owner;
$person = person($owner);
$name = (string)$person['name'];
if (!$viewer) $person['avatar_v'] = 0;   // profile pictures are only sent to logged-in people
$notebooks = load_notebooks($owner, !$isMe);   // you see all of yours; others only the ones you shared
$state = $viewer && !$isMe ? friendship($viewer, $owner) : 'none';   // friends, sent, received or none (see people.php)
$back = 'u.php?u=' . $prof['slug'];
function friend_btn(string $do, int $id, string $label, string $cls, string $back): string
{
    return '<form method="post" action="people.php" class="inline"><input type="hidden" name="csrf" value="' . h(csrf_token()) . '"><input type="hidden" name="do" value="' . $do . '"><input type="hidden" name="id" value="' . $id . '"><input type="hidden" name="back" value="' . h($back) . '"><button class="' . $cls . '">' . h($label) . '</button></form>';
}
$actions = '';
if ($isMe) {
    $actions = '<a class="btn" href="index.php?tab=profile">Edit my notebooks</a>';
} elseif ($viewer) {
    if ($state === 'friends') $actions = '<a class="btn primary" href="messages.php?with=' . $owner . '">Message</a> <a class="btn" href="friend.php?id=' . $owner . '">Today\'s plan</a>';
    elseif ($state === 'sent') $actions = friend_btn('cancel', $owner, 'Requested · cancel', 'btn ghost', $back);
    elseif ($state === 'received') $actions = friend_btn('accept', $owner, 'Accept friend request', 'btn primary', $back);
    else $actions = friend_btn('add', $owner, 'Add friend', 'btn primary', $back);
} else {
    $actions = '<a class="btn primary" href="login.php">Log in to add friend</a>';
}

if (!$notebooks) {
    app_top($name . "'s profile", ['tab' => $isMe ? 'profile' : '', 'active' => 'explore', 'eyebrow' => '@' . $prof['slug'], 'h1' => $name, 'actions' => $actions]);
    echo '<div class="who-line">' . avatar_html($person, 'lg') . ($prof['bio'] !== '' ? '<p class="bio" translate="no">' . nl2br(h($prof['bio'])) . '</p>' : '') . '</div>';
    echo '<div class="pub-note">' . ($isMe ? 'You have no notebooks yet. Make one in the Profile tab of your planner.' : 'No notebooks are shared here yet.') . '</div>';
    app_bottom();
    exit;
}

// which notebook, and which page of it
$nb = $notebooks[0];
foreach ($notebooks as $n) if ((int)($_GET['nb'] ?? 0) === $n['id']) $nb = $n;
$design = $nb['design'];
$sections = $nb['sections'];
$page = (string)($_GET['p'] ?? 'cover');
if ($page !== 'cover' && !in_array($page, $sections, true)) $page = 'cover';
$cover = $nb['cover_url'];
$base = 'u.php?u=' . rawurlencode($prof['slug']) . '&nb=' . $nb['id'];

$LABEL = ['cover' => 'Cover', 'interests' => 'Interests', 'blog' => 'Blog', 'timetable' => 'Timetable', 'subjects' => 'Studying'];
$tabs = '';
foreach (array_merge(['cover'], $sections) as $k) {
    $tabs .= '<a class="tab" role="tab" data-tab="' . $k . '" href="' . h($base . ($k === 'cover' ? '' : '&p=' . $k)) . '"' . ($k === $page ? ' aria-selected="true"' : '') . '>' . $LABEL[$k] . '</a>';
}

app_top($nb['title'] . ' · ' . $name, ['tab' => '', 'active' => $isMe ? '' : 'explore', 'design' => $design, 'tabs' => $tabs, 'covers' => true,
    'eyebrow' => ($page === 'cover' ? '@' . $prof['slug'] . ' · notebook' : $name . ' · ' . $nb['title']), 'h1' => $page === 'cover' ? $nb['title'] : $LABEL[$page], 'actions' => $actions]);
?>
  <?php if ($isMe): ?>
    <p class="hint2" style="font-size:13px;margin:-8px 0 14px">This is how <?= $nb['public'] ? ((int)$prof['is_public'] ? ((int)$prof['guest_view'] ? 'everyone, even visitors without an account,' : 'people with an account') : 'nobody but you (your profile is private)') : 'nobody but you' ?> sees this notebook.
      <?= $nb['public'] ? '' : 'It is private right now. Switch it on in the Profile tab.' ?></p>
  <?php endif; ?>

  <?php if (count($notebooks) > 1): ?>
    <nav class="nbshelf" aria-label="Notebooks">
      <?php foreach ($notebooks as $n): ?>
        <a class="nbchip<?= $n['id'] === $nb['id'] ? ' on' : '' ?>" href="u.php?u=<?= h(rawurlencode($prof['slug'])) ?>&amp;nb=<?= $n['id'] ?>"<?= design_attrs($n['design'], 'accent') . design_style($n['design']) ?>>
          <i style="<?= cover_css($n['design'], $n['cover_url']) ?>"></i><span translate="no"><?= h($n['title']) ?></span><?= $n['public'] ? '' : ' <small>🔒</small>' ?>
        </a>
      <?php endforeach; ?>
    </nav>
  <?php endif; ?>

  <?php if ($page === 'cover'): ?>
    <div class="nbcover" style="<?= cover_css($design, $cover) ?>">
      <div class="nbcover-in">
        <?= avatar_html($person, 'xl') ?>
        <h2 translate="no"><?= h($nb['title']) ?></h2>
        <p class="by" translate="no">by <?= h($name) ?> · @<?= h($prof['slug']) ?></p>
      </div>
    </div>
    <?php if ($nb['intro'] !== ''): ?><p class="nb-intro" translate="no"><?= nl2br(h($nb['intro'])) ?></p><?php endif; ?>
    <?php if ($prof['bio'] !== ''): ?><p class="bio" translate="no"><?= nl2br(h($prof['bio'])) ?></p><?php endif; ?>
    <?php if (!$sections): ?><p class="hint2" style="margin-top:14px">No pages in this notebook yet.</p><?php endif; ?>

  <?php elseif ($page === 'blog'):
    $posts = load_posts($owner, !$isMe, $viewer, $nb['id']);
    if ($posts): foreach ($posts as $p): ?>
      <article class="post" data-pid="<?= $p['id'] ?>">
        <?php if ($p['image']): ?><img class="pimg" src="<?= h($p['image']) ?>" alt=""><?php endif; ?>
        <div class="pb" translate="no">
          <h3><?= h($p['title']) ?></h3>
          <div class="meta2"><?= h($p['date']) ?><?= $isMe && !$p['public'] ? ' · <span class="tag2 priv">Only me</span>' : '' ?></div>
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
    <?php endforeach; else: ?><p class="empty">Nothing here yet.</p><?php endif; ?>

  <?php elseif ($page === 'interests'):
    $lists = load_lists($owner, !$isMe, $nb['id']);
    if ($lists): ?><div class="ilists">
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
    </div><?php else: ?><p class="empty">Nothing here yet.</p><?php endif; ?>

  <?php elseif ($page === 'timetable'):
    $WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    $timetable = load_timetable($owner);
    if ($timetable): ?>
      <div style="overflow:auto"><table class="tt"><thead><tr><?php foreach ($WD as $w): ?><th><?= $w ?></th><?php endforeach; ?></tr></thead>
        <tbody><tr>
          <?php for ($d = 0; $d < 7; $d++): ?><td translate="no"><?= isset($timetable[$d]) ? implode('<br>', array_map('h', $timetable[$d])) : '' ?></td><?php endfor; ?>
        </tr></tbody></table></div>
    <?php else: ?><p class="empty">No weekly plan yet.</p><?php endif; ?>

  <?php elseif ($page === 'subjects'):
    $subjects = load_subjects($owner);
    if ($subjects): ?><div class="xcard">
      <?php foreach ($subjects as $s): ?>
        <div class="subj-row"><b style="min-width:120px" translate="no"><?= h($s['name']) ?></b><div class="bar"><i style="width:<?= $s['pct'] ?>%"></i></div><span class="hint2"><?= $s['pct'] ?>% of <?= $s['n'] ?> chapter<?= $s['n'] === 1 ? '' : 's' ?></span></div>
      <?php endforeach; ?>
    </div><?php else: ?><p class="empty">No subjects yet.</p><?php endif; ?>
  <?php endif; ?>

<?php app_inside(stickers_html($design, $page)); ?>
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
<?php app_bottom();
