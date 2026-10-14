# Friends, profiles and messages in Splanner

## How it works (for users)

**Your profile.** Click **People** at the top of the planner, then **Edit profile**. There you can:
- pick a profile picture
- write a short bio
- choose a notebook cover: vintage botanical ones with your name on a label (wildflowers, cherries & bows, autumn leaves, woodland, pressed ferns, rose vine), or pink spiral ones with your own words in handwriting
- change your name

Your name is your username. If someone else has the same name, people see your email under it so they can tell you apart.

**Adding friends.** On **People**, search for someone by name or email and click **Add friend**. They see a number on their People button and can **Accept** or **Decline**.

**A friend's notebook.** Your friends appear on the People page as a shelf of notebooks, each in the cover they picked. Open one to see their profile and **their hour-by-hour plan for today**. Nothing else from their planner is shown: no tasks, money, study or other days. Only friends can open it, and you can remove a friend at any time.

**Messages.** Click **Messages** (or **Message** on a friend's notebook), or type someone's email to write to them. Press Enter to send. New messages appear within about 20 seconds. Only the two of you can see them.

## How it was made

Splanner is PHP + MySQL on free InfinityFree hosting. InfinityFree has two rules that shaped this:
- It blocks any address with the word **"chat"** in it (that caused the 403 error). So the page is `messages.php` and the actions are called `msg.*`.
- It doesn't allow live chat that refreshes all the time. So the messages page only checks for new messages **every 20 seconds**, and not at all while the tab is in the background.

| File | What it does |
|---|---|
| `sql/schema.sql`, `sql/schema-sqlite.sql` | Three new tables. `messages`: sender, receiver, text, time, read or not. `profiles`: bio, cover, picture. `friends`: who asked whom, and whether it was accepted. |
| `db.php` | Adds the new tables to the existing database by itself the first time the site loads. Nothing needs importing. |
| `social.php` | Shared helpers: a person's profile, whether two people are friends, when to show the email next to a name, and today's plan for a user. The plan is worked out the same way as the planner: that day's own hours first, otherwise the weekly ↻ hours, with hours that run on joined into one entry. |
| `explore.php` | Everyone on the site, friend requests and the shelf of friends' notebooks. |
| `friend.php` | A friend's notebook: cover, picture, name, bio and today's plan. It refuses anyone who isn't a friend. |
| `profile.php` | Edit your name, bio, picture and cover. Pictures are cropped to a square and shrunk to 256×256, then stored in the database. That way the host needs no upload folder, and nobody can upload a script. |
| `avatar.php` | Sends a profile picture to logged-in users. |
| `messages.php`, `assets/messages.js` | The messages page. Messages are shown as plain text, so nobody can inject HTML. |
| `api.php` | `msg.list`, `msg.find`, `msg.messages`, `msg.send` (up to 2000 characters, at most 20 a minute). |
| `index.php` | The **People** and **Messages** buttons with their counts. |
| `assets/covers.css` | The notebook covers. Each pattern is a small SVG drawing repeated across the cover, with a spine and a name label, or spiral rings and script words. |
| `assets/style.css`, `assets/lang.js` | Layout (light, dark, phone) and the Albanian text. |

Every page checks that you're logged in with a confirmed email. Every form uses the site's CSRF token.
