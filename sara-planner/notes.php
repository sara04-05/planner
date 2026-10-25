<?php
// The study notebook: one notebook for every subject in the Study tab, with a place for each chapter's pages of notes,
// whiteboards to draw on, and study files (PDFs, slides, pictures, music).
// Private: only the owner sees them. The page is drawn by assets/notes.js and saves through noteapi.php.
// Visitors from "Look inside" see sample pages here, view only (assets/notes.js never calls noteapi.php for them).
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/social.php';
require __DIR__ . '/notebook.php';
require __DIR__ . '/layout.php';
require __DIR__ . '/notes-lib.php';

$tour = !current_user_id();
$uid = $tour ? 0 : require_login();
$open = isset($_GET['page']) && ctype_digit((string)$_GET['page']) ? (int)$_GET['page'] : 0;   // (?nb= and ?ch= open a notebook and chapter: read by notes.js)

app_top('Notes', ['tour' => $tour, 'tab' => 'notes', 'eyebrow' => 'Your study notebook', 'h1' => 'Notes',
    'actions' => '<button class="btn" type="button" data-nt="new-board">' . ico('board') . 'New whiteboard</button><button class="btn primary" type="button" data-nt="new-note">' . ico('note') . 'New page</button>']); ?>
    <div class="nt" id="notes" data-csrf="<?= h(csrf_token()) ?>" data-open="<?= $open ?>"<?= $tour ? ' data-tour="1"' : '' ?>>
      <aside class="nt-side">
        <input class="nt-search" id="ntSearch" type="search" placeholder="Search your notes" autocomplete="off">
        <ul class="nt-list" id="ntList"><li class="empty">Loading…</li></ul>
        <p class="nt-use" id="ntUse"></p>
      </aside>
      <section class="nt-main" id="ntMain"></section>
    </div>
    <div class="toast" id="toast" role="status" hidden></div>
<script src="assets/notes.js?v=<?= filemtime(__DIR__ . '/assets/notes.js') ?>"></script>
<?php app_bottom();
