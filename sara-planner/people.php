<?php
// Public notebooks you're allowed to see. Visitors who aren't logged in only get the ones whose owners opened them to everyone.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/layout.php';

$viewer = current_user_id();
if ($viewer && !is_verified($viewer)) $viewer = null;
$term = trim((string)($_GET['q'] ?? ''));

$sql = 'SELECT p.*, u.name FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.is_public = 1'
    . ($viewer ? '' : ' AND p.guest_view = 1');
$args = [];
if ($term !== '') {
    $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term) . '%';
    $sql .= " AND (u.name LIKE ? ESCAPE '\\' OR p.slug LIKE ? ESCAPE '\\')";
    $args = [$like, $like];
}
$sql .= ' ORDER BY u.name LIMIT 60';
$rows = q($sql, $args)->fetchAll();

pub_top('People', [], $viewer);
?>
  <h1 style="margin-bottom:6px">People</h1>
  <p class="hint2" style="font-size:14px;margin-bottom:16px">Notebooks that their owners chose to share.<?= $viewer ? '' : ' Log in to see more.' ?></p>
  <form class="searchbar" method="get" action="people.php">
    <input type="search" name="q" value="<?= h($term) ?>" placeholder="Search by name or page name" aria-label="Search people">
    <button class="btn primary">Search</button>
  </form>
  <?php if (!$rows): ?>
    <div class="pub-note">No public notebooks <?= $term !== '' ? 'match that search' : 'yet' ?>.</div>
  <?php else: ?>
  <div class="people">
    <?php foreach ($rows as $r):
        $d = profile_design($r); ?>
      <a class="person" href="u.php?u=<?= h($r['slug']) ?>"<?= design_attrs($d, 'accent') ?>>
        <?= banner_html($d, upload_url($d['cover_img'] ? (int)$d['cover_img'] : null)) ?>
        <div class="pb">
          <div class="av" aria-hidden="true"><?= h(mb_strtoupper(mb_substr($r['name'], 0, 1))) ?></div>
          <h3 translate="no"><?= h($r['name']) ?></h3>
          <p translate="no"><?= $r['bio'] !== '' ? h($r['bio']) : '@' . h($r['slug']) ?></p>
        </div>
      </a>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
<?php pub_bottom();
