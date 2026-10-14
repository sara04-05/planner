<?php
// Explore: everyone who has an account, shown as a name and nothing else. You have to be logged in to look.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';

$viewer = current_user_id();
if ($viewer && !is_verified($viewer)) $viewer = null;

if (!$viewer) {
    app_top('Explore', ['active' => 'explore', 'eyebrow' => 'Your notebook', 'h1' => 'Explore']); ?>
  <p class="auth-sub">Log in to see who else is on Splanner.</p>
  <p style="margin-top:16px"><a class="btn primary" href="login.php">Log in</a> <a class="btn" href="register.php">Create free account</a></p>
<?php
    app_bottom();
    exit;
}

$term = trim((string)($_GET['q'] ?? ''));
$sql = 'SELECT id, name FROM users WHERE email_verified = 1';
$args = [];
if ($term !== '') {
    $sql .= " AND name LIKE ? ESCAPE '|'";
    $args[] = '%' . str_replace(['|', '%', '_'], ['||', '|%', '|_'], $term) . '%';
}
$rows = q($sql . ' ORDER BY name LIMIT 500', $args)->fetchAll();

app_top('Explore', ['active' => 'explore', 'eyebrow' => 'Your notebook', 'h1' => 'Explore',
    'actions' => '<a class="btn" href="people.php">People</a>']);
?>
  <p class="hint2" style="font-size:14px;margin:-6px 0 16px"><?= count($rows) ?> <?= count($rows) === 1 ? 'person is' : 'people are' ?> on Splanner<?= $term !== '' ? ' matching your search' : '' ?>.</p>
  <form class="searchbar" method="get" action="explore.php">
    <input type="search" name="q" value="<?= h($term) ?>" placeholder="Search by name" aria-label="Search people">
    <button class="btn primary">Search</button>
  </form>
  <?php if (!$rows): ?>
    <div class="pub-note">Nobody matches that search.</div>
  <?php else: ?>
  <ul class="userlist">
    <?php foreach ($rows as $r): ?>
      <li translate="no"><span class="av" aria-hidden="true"><?= h(mb_strtoupper(mb_substr($r['name'], 0, 1))) ?></span><span class="un"><?= h($r['name']) ?></span></li>
    <?php endforeach; ?>
  </ul>
  <?php endif; ?>
<?php app_bottom();
