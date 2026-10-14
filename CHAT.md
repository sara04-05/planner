# Chat in Splanner

## How it works (for users)

1. In the planner, click **Chat** at the top. A small number next to it shows how many messages you haven't read.
2. To start a chat, type the other person's **email** (the one they log in with) and click **Open**. They need a Splanner account.
3. Write your message and press **Enter** (or **Send**). Shift+Enter makes a new line.
4. Your chats are listed on the left, newest first, with a number for unread messages.

Only the two people in a chat can see its messages. Nobody can browse a list of users; you can only reach someone whose email you already know.

## How it was made

Splanner is PHP + MySQL on free hosting (InfinityFree). Free hosting can't keep a live connection open to push messages to the browser, so the chat page **asks the server for new messages every 4 seconds** while it's open (this is called polling). It pauses while the tab is in the background, so it doesn't load the server for nothing.

| File | What it does |
|---|---|
| `sql/schema.sql`, `sql/schema-sqlite.sql` | New `messages` table: who sent it (`from_id`), who gets it (`to_id`), the text (`body`), when (`sent_at`, a Unix time) and whether it was read (`is_read`). Deleting an account deletes its messages. |
| `db.php` | Adds the `messages` table to an existing database by itself the first time the site loads, so nothing has to be imported by hand. `chat_unread()` counts unread messages for the Chat button. |
| `api.php` | Four new actions: `chat.list` (your chats), `chat.find` (find a person by exact email), `chat.messages` (one chat, or only the messages newer than the last one the page has, and marks them read) and `chat.send` (save a message, at most 2000 characters and 20 a minute). |
| `chat.php` | The chat page. |
| `assets/chat.js` | Draws the chats, sends messages and does the polling. Messages are shown as plain text, so nobody can inject HTML or scripts. |
| `assets/style.css` | The chat bubbles and layout, in light and dark mode and on phones. |
| `assets/lang.js` | Albanian translations for the new text. |
| `index.php` | The **Chat** button with the unread count. |

Every API call goes through the same checks as the rest of the planner: you must be logged in, have a confirmed email, and send the page's CSRF token. Every query only reads messages where you are the sender or the receiver.
