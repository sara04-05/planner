<?php
// Someone's profile: u.php?u=<page name>. A profile is just their notebooks. Opening one shows it in the same notebook layout as
// the rest of the site: its own paper, colours and stickers, and its pages (cover, interests, blog…) as the side tabs.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';


/** The Instagram-style top of a profile: picture, @page name, stats, name, bio and the buttons. $stats = [label => number]. */
function profile_head(array $person, string $slug, array $stats, string $actions, string $badge = ''): string
{
    $out = '<header class="phead"><div class="phead-av">' . avatar_html($person, 'xl') . '</div><div class="phead-main">'
        . '<div class="phead-top"><h2 translate="no">' . ($slug !== '' ? '@' . h($slug) : h($person['name'])) . vbadge(!empty($person['verified'])) . '</h2>' . $badge . '</div>';
    if ($stats) {
        $out .= '<div class="pstats">';
        foreach ($stats as $label => $n) $out .= '<span class="pstat"><b>' . (int)$n . '</b><span>' . h($label) . '</span></span>';
        $out .= '</div>';
    }
    $out .= '<p class="pname2" translate="no">' . h($person['name']) . '</p>'
        . ($person['bio'] !== '' ? '<p class="pbio2" translate="no">' . h($person['bio']) . '</p>' : '')
        . '</div>' . ($actions !== '' ? '<div class="phead-btns">' . $actions . '</div>' : '') . '</header>';
    return $out;
}
function plural(int $n, string $one, string $many): string
{
    return $n === 1 ? $one : $many;
}

$viewer = current_user_id();
if ($viewer && !is_verified($viewer)) $viewer = null;
$slug = strtolower(trim((string)($_GET['u'] ?? '')));
$uid = isset($_GET['id']) && ctype_digit((string)$_GET['id']) ? (int)$_GET['id'] : 0;   // people without a page name are opened by id (from Explore)
$prof = $slug !== '' ? q('SELECT * FROM profiles WHERE slug = ?', [$slug])->fetch()
    : ($uid ? q('SELECT * FROM profiles WHERE user_id = ?', [$uid])->fetch() : false);
if (!$prof && $uid && $uid !== $viewer && person($uid)) $prof = ['user_id' => $uid, 'bio' => '', 'slug' => '', 'is_public' => 0, 'guest_view' => 0];   // account without a profile row yet: private

if ($prof && $viewer && !can_view_profile($prof, $viewer)) {
    // A private account: all that is shown is the profile itself (picture, name, bio and the friend buttons), no notebooks.
    $owner = (int)$prof['user_id'];
    $person = person($owner);
    if (!$person) { http_response_code(404); app_top('Not found', ['active' => 'explore', 'h1' => 'Not found']); app_bottom(); exit; }
    $state = friendship($viewer, $owner);
    $back = 'u.php?id=' . $owner;
    $btn = function (string $do, string $label, string $cls) use ($owner, $back): string {
        return '<form method="post" action="explore.php" class="inline"><input type="hidden" name="csrf" value="' . h(csrf_token()) . '"><input type="hidden" name="do" value="' . $do . '"><input type="hidden" name="id" value="' . $owner . '"><input type="hidden" name="back" value="' . h($back) . '"><button class="' . $cls . '">' . h($label) . '</button></form>';
    };
    if ($state === 'friends') $actions = '<a class="btn primary" href="messages.php?with=' . $owner . '">Message</a> <a class="btn" href="friend.php?id=' . $owner . '">Today\'s plan</a> <a class="btn" href="hangout.php?with=' . $owner . '">🗓️ Find time together</a>';
    elseif ($state === 'sent') $actions = $btn('cancel', 'Requested · cancel', 'btn ghost');
    elseif ($state === 'received') $actions = $btn('accept', 'Accept friend request', 'btn primary');
    else $actions = $btn('add', 'Add friend', 'btn primary');
    app_top($person['name'] . "'s profile", ['active' => 'explore']);
    $nf = count(friend_ids($owner));
    echo profile_head($person, '', [plural($nf, 'friend', 'friends') => $nf], $actions, '<span class="tag2 priv">Private</span>');
    echo '<div class="pub-note">🔒 This account is private.</div>';
    app_bottom();
    exit;
}

if (!$prof || !can_view_profile($prof, $viewer)) {
    $needLogin = $prof && (int)$prof['is_public'] === 1 && !$viewer;
    http_response_code($needLogin ? 403 : 404);
    app_top($needLogin ? 'Log in to see this notebook' : 'Private notebook', ['active' => 'explore', 'eyebrow' => 'Your notebook',
        'h1' => $needLogin ? 'Log in to open this notebook' : 'This notebook is private']);
    ?>
  <p class="auth-sub"><?= $needLogin ? 'The owner shares it with people who have an account.' : 'It is either not shared, or the page name is wrong.' ?></p>
  <p style="margin-top:16px">
    <?php if ($needLogin): ?><a class="btn primary" href="login.php">Log in</a> <a class="btn" href="register.php">Create free account</a>
    <?php else: ?><a class="btn" href="explore.php">See who is on Splanner</a><?php endif; ?>
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
$state = $viewer && !$isMe ? friendship($viewer, $owner) : 'none';   // friends, sent, received or none (see explore.php)
$back = 'u.php?u=' . $prof['slug'];
function friend_btn(string $do, int $id, string $label, string $cls, string $back): string
{
    return '<form method="post" action="explore.php" class="inline"><input type="hidden" name="csrf" value="' . h(csrf_token()) . '"><input type="hidden" name="do" value="' . $do . '"><input type="hidden" name="id" value="' . $id . '"><input type="hidden" name="back" value="' . h($back) . '"><button class="' . $cls . '">' . h($label) . '</button></form>';
}
$actions = '';
if ($isMe) {
    $actions = '<a class="btn" href="index.php?tab=profile">Edit my notebooks</a>';
} elseif ($viewer) {
    if ($state === 'friends') $actions = '<a class="btn primary" href="messages.php?with=' . $owner . '">Message</a> <a class="btn" href="friend.php?id=' . $owner . '">Today\'s plan</a> <a class="btn" href="hangout.php?with=' . $owner . '">🗓️ Find time together</a>';
    elseif ($state === 'sent') $actions = friend_btn('cancel', $owner, 'Requested · cancel', 'btn ghost', $back);
    elseif ($state === 'received') $actions = friend_btn('accept', $owner, 'Accept friend request', 'btn primary', $back);
    else $actions = friend_btn('add', $owner, 'Add friend', 'btn primary', $back);
} else {
    $actions = '<a class="btn primary" href="login.php">Log in to add friend</a>';
}

// No notebook is shared with this viewer, but they may still be allowed to see the person's day: show a notebook with only the Day page
$dayOnly = false;
if (!$notebooks && can_see_day($owner, $viewer)) {
    $dayOnly = true;
    $notebooks = [['id' => 0, 'title' => $name . "'s notebook", 'intro' => '', 'sections' => [], 'design' => profile_design($prof), 'cover_url' => '', 'public' => 0]];
    $_GET['p'] = 'day';
}

if (!$notebooks) {
    app_top($name . "'s profile", ['tab' => $isMe ? 'profile' : '', 'active' => 'explore']);
    $nf = count(friend_ids($owner));
    echo profile_head($person, (string)$prof['slug'], ['notebooks' => 0, plural($nf, 'friend', 'friends') => $nf], $actions);
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
$showDay = can_see_day($owner, $viewer);   // the Day page: today's plan, for whoever the owner allowed
$pagesById = [];
foreach ($nb['pages'] ?? [] as $cp) $pagesById['pg:' . $cp['id']] = $cp;
if ($page !== 'cover' && !in_array($page, $sections, true) && !isset($pagesById[$page]) && !($page === 'day' && $showDay)) $page = 'cover';
$cover = $nb['cover_url'];
$base = ((string)$prof['slug'] !== '' ? 'u.php?u=' . rawurlencode($prof['slug']) : 'u.php?id=' . $owner) . '&nb=' . $nb['id'];

$LABEL = ['cover' => 'Cover', 'interests' => 'Interests', 'blog' => 'Blog', 'timetable' => 'Timetable', 'subjects' => 'Studying', 'day' => 'Day'];
$tabs = '';
foreach ($pagesById as $k => $cp) $LABEL[$k] = trim($cp['emoji'] . ' ' . $cp['title']);
foreach ($dayOnly ? ['day'] : array_merge(['cover'], $sections, array_keys($pagesById), $showDay ? ['day'] : []) as $k) {
    $tabs .= '<a class="tab" role="tab" data-tab="' . $k . '" href="' . h($base . ($k === 'cover' ? '' : '&p=' . $k)) . '"' . ($k === $page ? ' aria-selected="true"' : '') . '>' . h($LABEL[$k]) . '</a>';
}

$nPosts = 0;   // public posts in the notebooks this viewer can open
foreach ($notebooks as $n) if (in_array('blog', $n['sections'], true)) $nPosts += count(load_posts($owner, !$isMe, null, $n['id']));
$nFriends = count(friend_ids($owner));
$topOpts = ['tab' => '', 'active' => $isMe ? '' : 'explore', 'design' => $design, 'tabs' => $tabs, 'covers' => true];
if ($page !== 'cover') $topOpts += ['eyebrow' => $name . ' · ' . $nb['title'], 'h1' => $LABEL[$page]];
app_top($nb['title'] . ' · ' . $name, $topOpts);
echo profile_head($person, (string)$prof['slug'], [plural($dayOnly ? 0 : count($notebooks), 'notebook', 'notebooks') => $dayOnly ? 0 : count($notebooks), plural($nPosts, 'post', 'posts') => $nPosts, plural($nFriends, 'friend', 'friends') => $nFriends], $actions,
    $isMe ? '' : ((int)$prof['is_public'] ? '' : '<span class="tag2 priv">Private</span>'));
?>
  <?php if (!$dayOnly): ?><nav class="nbtiles" aria-label="Notebooks">
    <?php foreach ($notebooks as $n): ?>
      <a class="nbtile<?= $n['id'] === $nb['id'] ? ' on' : '' ?>" href="u.php?u=<?= h(rawurlencode($prof['slug'])) ?>&amp;nb=<?= $n['id'] ?>"<?= design_attrs($n['design'], 'accent') . design_style($n['design']) ?>>
        <i style="<?= cover_css($n['design'], $n['cover_url']) ?>"></i><span translate="no"><?= h($n['title']) ?></span>
      </a>
    <?php endforeach; ?>
  </nav><?php endif; ?>



  <?php if ($page === 'cover'): ?>
    <div class="nbcover"<?= cover_attrs($design) ?> style="<?= cover_css($design, $cover) ?>">
      <div class="nbcover-in">
        <?= avatar_html($person, 'xl') ?>
        <h2 translate="no"><?= h($nb['title']) ?></h2>
        <p class="by" translate="no">by <?= h($name) ?> · @<?= h($prof['slug']) ?></p>
      </div>
    </div>
    <?php if ($nb['intro'] !== ''): ?><p class="nb-intro" translate="no"><?= nl2br(h($nb['intro'])) ?></p><?php endif; ?>
    <?php if (!$sections): ?><p class="hint2" style="margin-top:14px">No pages in this notebook yet.</p><?php endif; ?>

  <?php elseif (isset($pagesById[$page])): ?>
    <div class="nb-text" translate="no"><?= nl2br(h($pagesById[$page]['body'])) ?></div>

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

  <?php elseif ($page === 'day'):
    $today = date('Y-m-d');
    $plan = day_schedule($owner, $today);
    $nowMin = (int)date('G') * 60 + (int)date('i'); ?>
    <?php if ($isMe): ?><p class="hint2">Who sees this: <?= h(['Nobody but you', 'Your friends', 'Anyone signed in', 'Everyone'][day_level($prof)]) ?>. Change it in Edit profile &amp; settings.</p><?php endif; ?>
    <h2 class="nb-date"><?= h(date('l, j F', strtotime($today))) ?></h2>
    <?php if (!$plan): ?><p class="nb-empty">Nothing planned today.</p>
    <?php else: ?><ol class="nb-plan">
      <?php foreach ($plan as $e): $type = isset(HOUR_COLORS[$e['type']]) ? $e['type'] : 'personal'; ?>
        <li class="<?= $nowMin >= $e['from'] && $nowMin < $e['to'] ? 'now' : ($nowMin >= $e['to'] ? 'past' : '') ?>" style="--hc:var(--c-<?= HOUR_COLORS[$type] ?>)">
          <span class="nb-time"><?= hm($e['from']) ?>–<?= hm(min($e['to'], 1440)) ?></span><span class="nb-mark"></span>
          <span class="nb-what" translate="no"><?= h($e['text']) ?></span><span class="nb-type"><?= h(HOUR_NAMES[$type]) ?></span>
        </li>
      <?php endforeach; ?></ol><?php endif; ?>

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
