<?php
// Chat with other Splanner users. The page asks api.php for new messages every few seconds
// (free hosting can't keep a live connection open), see assets/chat.js.
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/layout.php';

$uid = require_login();
$with = isset($_GET['with']) && ctype_digit((string)$_GET['with']) ? (int)$_GET['with'] : 0;

auth_top('Chat', 'wide chat-card'); ?>
    <div class="admin-top">
      <h1>Chat</h1>
      <a class="btn" href="index.php">Back to planner</a>
    </div>
    <div class="chat" id="chat" data-csrf="<?= h(csrf_token()) ?>" data-with="<?= $with ?>">
      <aside class="chat-side">
        <form class="chat-find" id="chatFind">
          <label for="chatEmail">Start a chat</label>
          <div class="chat-row">
            <input id="chatEmail" type="email" placeholder="Their email" autocomplete="off" required>
            <button class="btn primary">Open</button>
          </div>
        </form>
        <ul class="chat-people" id="chatPeople"><li class="chat-empty">No chats yet. Type someone's email above to start one.</li></ul>
      </aside>
      <section class="chat-main" id="chatMain">
        <p class="chat-empty chat-pick">Pick a chat, or start one with someone's email.</p>
      </section>
    </div>
<script src="assets/chat.js?v=<?= filemtime(__DIR__ . '/assets/chat.js') ?>"></script>
<?php auth_bottom();
