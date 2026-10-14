<?php
// Explore: public notebooks you're allowed to see (never your own). Visitors who aren't logged in only get the ones whose owners opened them to everyone.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';

$viewer = current_user_id();
if ($viewer && !is_verified($viewer)) $viewer = null;
$term = trim((string)($_GET['q'] ?? ''));

$sql = 'SELECT p.*, u.name FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.is_public = 1 AND p.slug IS NOT NULL'
    . ($viewer ? ' AND p.user_id <> ' . (int)$viewer : ' AND p.guest_view = 1');
$args = [];
if ($term !== '') {
    $like = '%' . str_replace(['|', '%', '_'], ['||', '|%', '|_'], $term) . '%';
    $sql .= " AND (u.name LIKE ? ESCAPE '|' OR p.slug LIKE ? ESCAPE '|')";
    $args = [$like, $like];
}
$sql .= ' ORDER BY u.name LIMIT 60';
$rows = [];
foreach (q($sql, $args)->fetchAll() as $r) {
    $r['nbs'] = load_notebooks((int)$r['user_id'], true);
    if ($r['nbs']) $rows[] = $r;      // only people who share at least one notebook
}

app_top('Explore', ['active' => 'explore', 'tab' => '', 'eyebrow' => 'Your notebook', 'h1' => 'Explore',
    'actions' => $viewer ? '<a class="btn" href="people.php">People</a>' : '']);
?>
  <p class="hint2" style="font-size:14px;margin:-6px 0 16px">Notebooks that their owners chose to share.<?= $viewer ? '' : ' Log in to see more.' ?></p>
  <form class="searchbar" method="get" action="explore.php">
    <input type="search" name="q" value="<?= h($term) ?>" placeholder="Search by name or page name" aria-label="Search people">
    <button class="btn primary">Search</button>
  </form>
  <?php if (!$rows): ?>
    <div class="pub-note">No public notebooks <?= $term !== '' ? 'match that search' : 'from other people yet' ?>.</div>
  <?php else: ?>
  <div class="people">
    <?php foreach ($rows as $r): echo person_card($r, $r['nbs']); endforeach; ?>
  </div>
  <?php endif; ?>
<?php app_bottom();
