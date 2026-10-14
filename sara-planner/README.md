# Splanner (PHP + MySQL)

A study, task and money planner where anyone can create an account and gets their own private planner.

## What's in the folder

```
sara-planner/
├── welcome.php        The public front page (what logged-out visitors see)
├── index.php          The planner page (only for logged-in users)
├── login.php          Log in
├── register.php       Create an account
├── logout.php         Log out
├── admin.php          List of every account (only for the site owner)
├── verify.php         "Check your email" page: type the emailed code, or fix a wrong email
├── calendar.php       Connect / disconnect Google Calendar
├── api.php            Saves and loads all data (the JavaScript talks to this)
├── db.php             Database connection, sessions, security helpers
├── config.php         Your database settings  ← edit this
├── layout.php         Shared layout for the login/sign-up pages
├── gcal.php           Sends the Hour by hour plan to Google Calendar
├── social.php         People, friends, profile pictures, notebook covers (used by people.php, friend.php, messages)
├── people.php         Friends, friend requests, search and public notebooks (see ../MESSAGES.md)
├── friend.php         A friend's notebook with today's plan
├── profile.php        Edit your name, bio, picture and notebook cover
├── messages.php       Messages between users (full page); the planner also has a Messages tab
├── notebook.php       Sharing a notebook: privacy, design, blog, interest lists, likes, alerts, pictures (used by api.php)
├── u.php              A shared notebook (u.php?u=pagename), for friends, members or visitors
├── explore.php        Directory of public notebooks
├── upload.php         Picture upload (blog photos, interest pictures, banners, stickers)
├── media.php          Sends a picture, only to people who may see it (pictures live in the database)
├── mail.php           Sends emails through Gmail (the sign-up codes)
├── assets/
│   ├── style.css      All the design (notebook look, dark mode)
│   └── app.js         Everything interactive on the page
├── sql/
│   ├── schema.sql         Creates the MySQL database and tables
│   └── schema-sqlite.sql  Same tables for SQLite (optional)
└── data/              Only used if you choose SQLite
```

## How it works

1. `register.php` creates a user. The password is stored as a hash (`password_hash`), never as plain text.
2. PHP keeps you logged in with a session cookie.
3. `index.php` sends the page. Then `assets/app.js` asks `api.php?action=bootstrap` for **your** data.
4. Every change you make (adding an expense, ticking a task, typing in an hour) is sent to `api.php`,
   which saves it in MySQL. Every query includes `user_id = <you>`, so nobody can see or change someone else's data.

## Run it on your computer (XAMPP)

1. **Install XAMPP** from apachefriends.org. Open the XAMPP Control Panel and click **Start** next to **Apache** and **MySQL**.
2. **Copy the folder** into XAMPP's web folder:
   - Windows: `C:\xampp\htdocs\sara-planner`
   - Mac: `/Applications/XAMPP/htdocs/sara-planner`
3. **Create the database:** open http://localhost/phpmyadmin, click **Import**, choose `sql/schema.sql`, click **Import** (or **Go**) at the bottom.
   This creates a database called `sara_planner` with all the tables.
4. **Check `config.php`.** The defaults (user `root`, empty password) match a fresh XAMPP install.
5. Open **http://localhost/sara-planner** and create your account.

### Working on it in VS Code

- **File → Open Folder…** and pick `C:\xampp\htdocs\sara-planner`, so you edit the files XAMPP is serving.
- Recommended extension: **PHP Intelephense** (autocomplete and error checking for PHP).
- Save a file, then refresh the browser to see the change. (Live Server doesn't run PHP, so use the XAMPP address.)

### No XAMPP? Use SQLite instead

If PHP is installed on its own (`php -v` works in a terminal):

1. In `config.php` change `const DB_DRIVER = 'mysql';` to `const DB_DRIVER = 'sqlite';`
2. In the VS Code terminal, inside the project folder, run: `php -S localhost:8000`
3. Open http://localhost:8000. The database file is created automatically in `data/`.

## Put it online

You need a host with **PHP 8.1 or newer** and **MySQL/MariaDB**. Most shared hosting has both, and there are free plans.

1. Create a MySQL database in your host's control panel and note the host, database name, user and password.
2. Open that database in phpMyAdmin and import `sql/schema.sql`.
   (If the host doesn't let you create a database called `sara_planner`, delete the first two lines of
   `schema.sql`, the `CREATE DATABASE` and `USE` lines, and import it into the database they gave you.)
3. Put your host's details into `config.php`.
4. Upload all the files (with FTP or the host's file manager) into the site's `public_html` / `htdocs` folder.
5. Turn on **HTTPS** (most hosts offer a free certificate). Logins should always go over HTTPS.

## See everyone who signed up

1. In `config.php` put the email you log in with: `const ADMIN_EMAILS = ['you@example.com'];`
2. Log in and click **Users** at the top of your planner (or open `admin.php`).
   You'll see each account's name, email, sign-up date and last login.

This page reads the database that the site you're on uses. On your laptop (`localhost`) it only shows
accounts made on your laptop; on the live site it shows everyone who signed up there.
Only the emails in `ADMIN_EMAILS` can open it; everyone else gets "Not allowed".

## Send your hours to Google Calendar

With this on, a **Show in Google Calendar** button appears above *Hour by hour* on the Day page.
After you click it and allow access, everything you plan hour by hour shows up in a calendar called
**Splanner** in your Google account. Changes are sent a couple of seconds after you type them, and your
weekly (↻) hours are filled in for the next two weeks. The planner can only touch that one calendar,
never your other calendars.

To turn it on (once, as the site owner):

1. Go to https://console.cloud.google.com, create a project (any name, e.g. "Splanner").
2. **APIs & Services → Library**: search for **Google Calendar API** and click **Enable**.
3. **APIs & Services → OAuth consent screen** (called *Google Auth Platform* in newer consoles):
   choose **External**, fill in the app name and your email. Under **Audience / Test users** add the Gmail
   addresses that will use it (while the app is in "Testing", only those can connect).
4. **Credentials → Create credentials → OAuth client ID**, type **Web application**. Under
   **Authorized redirect URIs** add the address of `calendar.php` on your site, for example
   `http://localhost/sara-planner/calendar.php` and, once it's online, `https://your-site.com/calendar.php`.
5. Copy the **Client ID** and **Client secret** into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `config.php`.

If Google says *redirect_uri_mismatch*, the address in step 4 must match exactly (http vs https, folder name).
You can also set it by hand in `GOOGLE_REDIRECT_URI`.

## Check that new users typed their email right (Gmail)

With this on, a new account gets a 6-digit code by email and has to type it in before the planner opens.
If the email was mistyped, the code never arrives, and the person can fix the email on the same page
and get a new code. Accounts made before you turned this on are not asked.

1. Use a Gmail account for the site (a new one like `splanner.app@gmail.com` is a good idea).
2. Turn on **2-Step Verification** for it: https://myaccount.google.com/security
3. Create an **app password**: https://myaccount.google.com/apppasswords (name it "Splanner"). Google shows 16 letters.
4. In `config.php` put the Gmail address in `GMAIL_USER` and the 16 letters in `GMAIL_APP_PASSWORD`.

Leave both empty and sign-up works like before, without the code.

## Share your notebook (blog, interests, design)

Five extra tabs sit next to Expenses:

- **Blog**: write posts with an optional picture. Each post is private or public.
- **Interests**: lists of favourite movies, singers, clothes (with pictures) or anything else, as a list or a picture grid. Each list is private or public.
- **Messages**: chat with your friends without leaving the planner (the same messages as the Messages page; new ones are looked for every 20 seconds). A friend you haven't written to yet is listed under Friends, so no email is needed.
- **Profile**: choose a page name and bio, decide who can see the notebook, and design it (banner or your own banner picture, paper style and colour, accent colour, handwriting, stickers) with a live preview. Name, profile picture and notebook cover are changed on the People page (**Edit profile**).
- **Alerts**: likes on your posts, with a switch to turn them off.

People connect as **friends** (People page, see `MESSAGES.md`); friends can message each other and see each other's day.

Nothing is shared by default. In **Profile → Who can see your notebook**:

- *Public profile* lists the notebook in **Explore** and lets anyone with an account open it (they can send you a friend request from there).
- *Visible without logging in* also opens it to visitors without an account.
- *What to show* picks which parts appear (blog, interests, weekly timetable, study subjects). Your planner itself is never shown.

Pictures are saved in the database (like profile pictures), so no upload folder is needed, and `media.php` only sends a picture to people who may see the post, list or notebook it belongs to.
The extra tables and columns are added automatically the first time the site runs, or import `sql/schema.sql` again. Pictures are re-drawn on upload, which shrinks them and removes hidden data such as camera location.

## Security that's already built in

- Passwords are hashed with `password_hash()`, and checked with `password_verify()`.
- All SQL uses prepared statements (no SQL injection).
- Every read and write is limited to the logged-in user's rows.
- Forms and API calls carry a CSRF token, so other websites can't act on your behalf.
- The session ID changes when you log in, and cookies are `HttpOnly` and `SameSite=Lax`.
- `.htaccess` blocks direct access to `config.php`, the SQL files and the `data/` folder (on Apache).
- Everything a user typed is escaped before it's shown on the page.

## Ideas for later

- "Forgot password" emails (the Gmail sending in `mail.php` can be reused for this).
- Limiting login attempts per IP address.
- Editing a subject's name or exam date after creating it.
- Exporting expenses to CSV.
