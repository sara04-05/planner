<?php
// Messages between Splanner users. Free hosting can't keep a live connection open, so the page asks api.php
// for new messages every few seconds (assets/messages.js, POLL_MS: a tiny request, raise it if the host starts
// refusing it). InfinityFree also blocks any address with "chat" in it, so nothing here is called chat.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';

$uid = require_login();
$with = isset($_GET['with']) && ctype_digit((string)$_GET['with']) ? (int)$_GET['with'] : 0;

app_top('Messages', ['active' => 'messages', 'eyebrow' => 'Your notebook', 'h1' => 'Messages']); ?>
    <div class="chat" id="chat" data-csrf="<?= h(csrf_token()) ?>" data-with="<?= $with ?>">
      <aside class="chat-side">
        <form class="chat-find" id="chatFind">
          <label for="chatEmail">Write to someone</label>
          <div class="chat-row">
            <input id="chatEmail" type="email" placeholder="Their email" autocomplete="off" required>
            <button class="btn primary">Open</button>
          </div>
        </form>
        <ul class="chat-people" id="chatPeople"><li class="chat-empty">No messages yet. Type someone's email above to start.</li></ul>
      </aside>
      <section class="chat-main" id="chatMain">
        <p class="chat-empty chat-pick">Pick a conversation, or start one with someone's email.</p>
      </section>
    </div>
<script src="assets/messages.js?v=<?= filemtime(__DIR__ . '/assets/messages.js') ?>"></script>
<?php app_bottom();
