<?php
// Your profile: the name, bio, picture and notebook cover other people see.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';

$uid = require_login();
$error = '';
$saved = isset($_GET['saved']);

/** Turn an uploaded picture into a 256×256 JPEG (cropped to a square). Returns "image/jpeg;<base64>" or an error. */
function avatar_from_upload(array $f): array
{
    if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE || $f['size'] > 5 * 1024 * 1024) {
        return [null, 'That picture is too big. Pick one under 5 MB.'];
    }
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) return [null, 'The picture could not be uploaded. Try again.'];
    $info = @getimagesize($f['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp', IMAGETYPE_GIF => 'image/gif'];
    if (!$info || !isset($types[$info[2]])) return [null, 'Pick a JPG, PNG, WebP or GIF picture.'];
    $raw = file_get_contents($f['tmp_name']);

    if (function_exists('imagecreatefromstring') && ($src = @imagecreatefromstring($raw))) {
        $w = imagesx($src); $hgt = imagesy($src); $side = min($w, $hgt);
        $dst = imagecreatetruecolor(256, 256);
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));   // transparent PNGs get a white background
        imagecopyresampled($dst, $src, 0, 0, intdiv($w - $side, 2), intdiv($hgt - $side, 2), 256, 256, $side, $side);
        ob_start();
        imagejpeg($dst, null, 85);
        return ['image/jpeg;' . base64_encode((string)ob_get_clean()), ''];
    }
    // Host without the GD image library: keep the file as it is, if it's small
    if (strlen($raw) > 600 * 1024) return [null, 'That picture is too big. Pick one under 600 KB.'];
    return [$types[$info[2]] . ';' . base64_encode($raw), ''];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!check_csrf($_POST['csrf'] ?? null)) {
        $error = 'Your session expired. Please try again.';
    } else {
        $name  = trim((string)($_POST['name'] ?? ''));
        $bio   = mb_substr(trim((string)($_POST['bio'] ?? '')), 0, 300);
        $cover = (string)($_POST['cover'] ?? DEFAULT_COVER);
        if (!isset(COVERS[$cover])) $cover = DEFAULT_COVER;
        $words = mb_substr(trim((string)($_POST['words'] ?? '')), 0, 60);
        $avatar = false;   // false = keep the picture as it is
        if (!empty($_POST['remove_avatar'])) $avatar = null;
        if (!empty($_FILES['avatar']) && $_FILES['avatar']['error'] !== UPLOAD_ERR_NO_FILE) {
            [$avatar, $error] = avatar_from_upload($_FILES['avatar']);
            if ($error) $avatar = false;
        }
        if ($name === '') $error = 'Please fill in your name.';
        if (!$error) {
            q('UPDATE users SET name = ? WHERE id = ?', [mb_substr($name, 0, 80), $uid]);
            if (!q('SELECT 1 FROM profiles WHERE user_id = ?', [$uid])->fetch()) {
                q('INSERT INTO profiles (user_id) VALUES (?)', [$uid]);
            }
            q('UPDATE profiles SET bio = ?, cover = ? WHERE user_id = ?', [$bio, $cover, $uid]);
            try {
                q('UPDATE profiles SET words = ? WHERE user_id = ?', [$words, $uid]);
            } catch (PDOException $e) {   // words column couldn't be added on this host
                error_log('Could not save cover words: ' . $e->getMessage());
            }
            if ($avatar !== false) {
                q('UPDATE profiles SET avatar = ?, avatar_v = ? WHERE user_id = ?', [$avatar, $avatar ? time() : 0, $uid]);
            }
            header('Location: profile.php?saved=1');
            exit;
        }
    }
}

$me = person($uid);
app_top('Your profile', ['tab' => 'profile', 'covers' => true, 'eyebrow' => 'Your notebook', 'h1' => 'Name & picture', 'actions' => '<a class="btn" href="index.php?tab=profile">Back to my profile</a>']); ?>
    <p class="auth-sub">This is what your friends see. They can also see your hour-by-hour plan for today, nothing else.</p>
    <?php if ($error): ?><div class="formmsg err" role="alert"><?= h($error) ?></div><?php endif; ?>
    <?php if ($saved && !$error): ?><div class="formmsg ok" role="status">Saved.</div><?php endif; ?>
    <form method="post" enctype="multipart/form-data" class="auth-form profile-form">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <div class="profile-pic">
        <?= avatar_html($me, 'xl') ?>
        <div>
          <label for="avatar">Profile picture<input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
          <?php if ($me['avatar_v']): ?><label class="check"><input type="checkbox" name="remove_avatar" value="1"> Remove my picture</label><?php endif; ?>
        </div>
      </div>
      <label for="name">Name (your username)<input id="name" name="name" value="<?= h($me['name']) ?>" required maxlength="80"></label>
      <?php if ($me['same_name']): ?><p class="hint">Someone else is also called <?= h($me['name']) ?>, so people see your email under your name to tell you apart.</p><?php endif; ?>
      <label for="bio">Bio<textarea id="bio" name="bio" rows="3" maxlength="300" placeholder="A few words about you"><?= h($me['bio']) ?></textarea></label>
      <div class="cover-pick">
        <div class="cover-preview" id="coverPreview"><?= cover_html($me) ?></div>
        <div class="cover-side">
          <fieldset class="covers">
            <legend>Notebook cover</legend>
            <?php foreach (COVERS as $k => [$label, $style]): ?>
              <label class="cover-opt" title="<?= h($label) ?>"><input type="radio" name="cover" value="<?= $k ?>" <?= $me['cover'] === $k ? 'checked' : '' ?>><?= cover_html($me, true, $k) ?><span><?= h($label) ?></span></label>
            <?php endforeach; ?>
          </fieldset>
          <label for="words">Words on a spiral cover<input id="words" name="words" value="<?= h($me['words']) ?>" maxlength="60" placeholder="e.g. she is fearless"></label>
          <p class="hint">Shown in handwriting on the pink spiral covers. Leave it empty to show your name.</p>
        </div>
      </div>
      <button class="btn primary">Save profile</button>
    </form>
    <template id="coverTpl"><?php foreach (COVERS as $k => $x): ?><div data-cover="<?= $k ?>"><?= cover_html($me, false, $k) ?></div><?php endforeach; ?></template>
    <script>
    (function(){
      var f=document.querySelector('.profile-form'),pv=document.getElementById('coverPreview'),tpl=document.getElementById('coverTpl').content;
      function paint(){
        var k=(f.querySelector('input[name=cover]:checked')||{}).value;if(!k)return;
        var n=tpl.querySelector('[data-cover="'+k+'"] .nbc').cloneNode(true),name=f.elements['name'].value.trim(),w=f.elements['words'].value.trim();
        var nm=n.querySelector('.nbc-name');if(nm)nm.textContent=name;
        var sc=n.querySelector('.nbc-script');if(sc)sc.textContent=w||name;
        var sm=n.querySelector('.nbc-small');if(sm)sm.textContent=w?name:'';
        pv.replaceChildren(n);
      }
      f.addEventListener('input',paint);f.addEventListener('change',paint);
    })();
    </script>
<?php app_bottom();
