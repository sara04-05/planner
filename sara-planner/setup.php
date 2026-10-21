<?php
// First visit after sign-up: choose the notebook style, then a short "how to use Splanner" intro (it can be skipped).
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';

$uid = require_login();
// the "finished the intro" flag: add the column here if this database does not have it yet, so this page never fails on a missing column
try {
    $have = DB_DRIVER === 'sqlite' ? array_column(db()->query('PRAGMA table_info(profiles)')->fetchAll(), 'name') : array_column(db()->query('SHOW COLUMNS FROM profiles')->fetchAll(), 'Field');
    if (!in_array('onboarded', $have, true)) db()->exec('ALTER TABLE profiles ADD COLUMN onboarded TINYINT(1) NOT NULL DEFAULT 1');
} catch (Throwable $e) {
    error_log('setup.php could not check the onboarded column: ' . $e->getMessage());
}
$prof = ensure_profile($uid);
if ((int)($prof['onboarded'] ?? 1) === 1 && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}
$name = (string)(q('SELECT name FROM users WHERE id = ?', [$uid])->fetch()['name'] ?? '');

// ready-made looks: [label, cover, paper, accent, binding]
$LOOKS = [
    ['Violet dusk', 'dusk', 'lined', 'violet', 'coil'], ['Rose garden', 'blossom', 'lined', 'rose', 'coil'],
    ['Ocean', 'ocean', 'grid', 'ocean', 'coil'], ['Mint', 'mint', 'lined', 'forest', 'stitch'],
    ['Peach', 'peach', 'dots', 'sunset', 'coil'], ['Dark academia', 'library', 'lined', 'graphite', 'stitch'],
    ['Starry night', 'stars', 'plain', 'violet', 'coil'], ['Matcha', 'matcha', 'grid', 'forest', 'coil'],
    ['Berry', 'berry', 'lined', 'rose', 'coil'], ['Sunny day', 'sunny', 'dots', 'sunset', 'none'],
    ['Midnight', 'night', 'grid', 'violet', 'stitch'], ['Cloud', 'cloud', 'plain', 'ocean', 'none'],
    ['Gingham', 'gingham', 'lined', 'rose', 'stitch'], ['Coquette', 'coquette', 'dots', 'rose', 'coil'],
    ['Lavender', 'lavender', 'lined', 'violet', 'coil'], ['Daisy', 'daisy', 'plain', 'sunset', 'coil'],
    ['Checker', 'checker', 'grid', 'graphite', 'coil'], ['Strawberry', 'strawberry', 'dots', 'rose', 'stitch'],
    ['Terrazzo', 'terrazzo', 'plain', 'graphite', 'none'], ['Waves', 'waves', 'grid', 'ocean', 'coil'],
    ['Sunset grain', 'sunsetgrain', 'lined', 'sunset', 'stitch'], ['Hearts', 'hearts', 'dots', 'rose', 'coil'],
    ['Rainbow', 'rainbow', 'plain', 'violet', 'coil'], ['Mountains', 'mountains', 'lined', 'forest', 'stitch'],
    ['Pinstripe', 'pinstripe', 'lined', 'graphite', 'none'], ['Monstera', 'monstera', 'grid', 'forest', 'coil'],
];

if ($_SERVER['REQUEST_METHOD'] === 'POST' && check_csrf($_POST['csrf'] ?? null)) {
    if (($_POST['do'] ?? '') === 'style') {   // keep the choices (the page stays open for the intro)
        $cover = (string)($_POST['cover'] ?? 'dusk');
        $d = default_design();
        $d['cover'] = in_array($cover, [...array_keys(COVER_GRADIENTS), ...ART_COVERS], true) ? $cover : 'dusk';
        if (in_array($_POST['paper'] ?? '', PAPERS, true)) $d['paper'] = $_POST['paper'];
        if (in_array($_POST['accent'] ?? '', ACCENTS, true)) $d['accent'] = $_POST['accent'];
        if (in_array($_POST['binding'] ?? '', BINDINGS, true)) $d['binding'] = $_POST['binding'];
        q('UPDATE profiles SET design = ? WHERE user_id = ?', [json_encode($d), $uid]);
        ensure_notebooks($uid);   // the first notebook starts from this look
        $nb = q('SELECT id FROM notebooks WHERE user_id = ? ORDER BY id LIMIT 1', [$uid])->fetch();
        if ($nb) q('UPDATE notebooks SET design = ? WHERE id = ?', [json_encode($d), (int)$nb['id']]);
        header('Content-Type: application/json');
        echo json_encode(['ok' => true]);
        exit;
    }
    q('UPDATE profiles SET onboarded = 1 WHERE user_id = ?', [$uid]);   // finished or skipped
    header('Location: index.php');
    exit;
}

$design = profile_design($prof);
auth_top('Welcome', 'setup-card', true);
?>
    <div class="setup" id="setup" data-accent="<?= h($design['accent'] ?? 'violet') ?>">
      <ol class="setup-dots" id="dots" aria-hidden="true"></ol>

      <section class="step" data-step="0">
        <h1>Welcome, <?= h(explode(' ', $name)[0]) ?>!</h1>
        <p class="auth-sub">First, choose how your notebook looks. You can change every detail later in your profile.</p>
        <div class="look-grid" id="looks">
          <?php foreach ($LOOKS as $i => $l): ?>
            <button type="button" class="look<?= $i === 0 ? ' on' : '' ?>" data-i="<?= $i ?>" data-cover="<?= h($l[1]) ?>" data-paper="<?= h($l[2]) ?>" data-accent="<?= h($l[3]) ?>" data-binding="<?= h($l[4]) ?>" aria-pressed="<?= $i === 0 ? 'true' : 'false' ?>">
              <span class="look-cover" style="<?= cover_css(['cover' => $l[1]]) ?>"></span><b><?= h($l[0]) ?></b>
            </button>
          <?php endforeach; ?>
        </div>
        <div class="look-extra">
          <label>Paper<select id="paper"><?php foreach (PAPERS as $p): ?><option value="<?= $p ?>"><?= ucfirst($p) ?></option><?php endforeach; ?></select></label>
          <label>Binding<select id="binding"><?php foreach (BINDINGS as $p): ?><option value="<?= $p ?>"><?= $p === 'none' ? 'Plain' : ucfirst($p) ?></option><?php endforeach; ?></select></label>
          <label>Colour<select id="accent"><?php foreach (ACCENTS as $p): ?><option value="<?= $p ?>"><?= ucfirst($p) ?></option><?php endforeach; ?></select></label>
        </div>
        <p class="look-pvh">How it will look</p>
        <div class="setup-preview" id="pv" data-paper="lined">
          <div class="nbcover mini" id="pvCover" style="<?= cover_css(['cover' => $LOOKS[0][1]]) ?>"><div class="nbcover-in"><h2 translate="no"><?= h($name) ?>'s notebook</h2></div></div>
          <div class="spread" id="pvSpread" data-binding="coil" data-paper="lined" style="<?= cover_css(['cover' => $LOOKS[0][1]]) ?>" aria-hidden="true">
            <div class="sp-page left"><p class="sp-eyebrow">Contents</p><h3 translate="no"><?= h($name) ?>'s notebook</h3>
              <ol><li><span>Interests</span><i>1</i></li><li><span>Blog</span><i>2</i></li><li><span>Timetable</span><i>3</i></li><li><span>Day</span><i>4</i></li></ol></div>
            <div class="sp-gutter"></div>
            <div class="sp-page right"><p class="sp-eyebrow">Welcome</p><h3 translate="no"><?= h($name) ?>'s notebook</h3>
              <p class="sp-intro">Your notes, plans and pages will go here.</p></div>
          </div>
        </div>
        <div class="setup-nav"><span></span><button type="button" class="btn primary" id="saveStyle">Choose this style →</button></div>
      </section>

      <?php
      $slides = [
          ['calendar', 'Plan your day', 'Day shows every hour. Write what you do, pick a type to colour it, and tap ↻ to repeat it every week. Week, Month and Year zoom out.'],
          ['cap', 'Study with a plan', 'In Study, add your subjects with an exam date and tick off chapters and topics as you learn them. Add study blocks to today.'],
          ['wallet', 'Know where your money goes', 'Add what you spend in Expenses. Set your income and savings goal in Year, and Splanner works out your daily allowance.'],
          ['notebook', 'Your notebook and friends', 'Your profile is a notebook with a blog, lists and pages. Explore lets you find people and add friends. You decide what each person can see.'],
      ];
      foreach ($slides as $i => $s): ?>
      <section class="step" data-step="<?= $i + 1 ?>" hidden>
        <div class="slide-ic" aria-hidden="true"><?= ico($s[0]) ?></div>
        <h1><?= h($s[1]) ?></h1>
        <p class="slide-tx"><?= h($s[2]) ?></p>
        <div class="setup-nav">
          <button type="button" class="btn ghost" data-go="<?= $i ?>"<?= $i === 0 ? ' hidden' : '' ?>>← Back</button>
          <button type="button" class="btn primary" data-go="<?= $i + 2 ?>"><?= $i === count($slides) - 1 ? 'Done' : 'Next →' ?></button>
        </div>
      </section>
      <?php endforeach; ?>

      <section class="step" data-step="<?= count($slides) + 1 ?>" hidden>
        <div class="slide-ic" aria-hidden="true"><?= ico('check') ?></div>
        <h1>You are all set</h1>
        <p class="slide-tx">Start by adding your uni and work hours in Day. Click the little ? any time you need help.</p>
        <form method="post" class="setup-nav"><input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><span></span><button class="btn primary">Start planning</button></form>
      </section>

      <form method="post" class="setup-skip" id="skipForm" hidden><input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><button class="linkbtn">Skip intro</button></form>
    </div>
    <script>
    (function(){
      var csrf=<?= json_encode(csrf_token()) ?>,steps=[].slice.call(document.querySelectorAll('.step')),dots=document.getElementById('dots'),root=document.getElementById('setup');
      steps.forEach(function(){dots.appendChild(document.createElement('li'))});
      function show(n){
        steps.forEach(function(s,i){s.hidden=i!==n});
        [].forEach.call(dots.children,function(d,i){d.className=i===n?'on':i<n?'done':''});
        document.getElementById('skipForm').hidden=n<1||n>=steps.length-1;
        window.scrollTo(0,0);
      }
      document.addEventListener('click',function(e){var b=e.target.closest('[data-go]');if(b)show(+b.dataset.go)});
      var cur={cover:'dusk',paper:'lined',accent:'violet',binding:'coil'},pv=document.getElementById('pv'),cv=document.getElementById('pvCover');
      function paint(){
        var sp=document.getElementById('pvSpread');
        pv.dataset.paper=cur.paper;sp.dataset.paper=cur.paper;sp.dataset.binding=cur.binding;root.dataset.accent=cur.accent;document.documentElement.dataset.accentTmp=cur.accent;
        var lc=document.querySelector('.look[data-cover="'+cur.cover+'"] .look-cover');
        if(lc){cv.style.background=lc.style.background;sp.style.background=lc.style.background}
        ['paper','binding','accent'].forEach(function(k){document.getElementById(k).value=cur[k]});
      }
      document.getElementById('looks').addEventListener('click',function(e){
        var b=e.target.closest('.look');if(!b)return;
        [].forEach.call(this.children,function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b)});
        cur={cover:b.dataset.cover,paper:b.dataset.paper,accent:b.dataset.accent,binding:b.dataset.binding};paint();
      });
      ['paper','binding','accent'].forEach(function(k){document.getElementById(k).addEventListener('change',function(){cur[k]=this.value;paint()})});
      document.getElementById('saveStyle').addEventListener('click',function(){
        var b=this,f=new FormData();b.disabled=true;f.append('csrf',csrf);f.append('do','style');for(var k in cur)f.append(k,cur[k]);
        fetch('setup.php',{method:'POST',body:f,credentials:'same-origin'}).then(function(r){return r.json()}).then(function(){show(1)}).catch(function(){b.disabled=false;alert('Could not save your style. Try again.')});
      });
      show(0);
    })();
    </script>
<?php auth_bottom();
