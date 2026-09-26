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
├── api.php            Saves and loads all data (the JavaScript talks to this)
├── db.php             Database connection, sessions, security helpers
├── config.php         Your database settings  ← edit this
├── layout.php         Shared layout for the login/sign-up pages
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

## Security that's already built in

- Passwords are hashed with `password_hash()`, and checked with `password_verify()`.
- All SQL uses prepared statements (no SQL injection).
- Every read and write is limited to the logged-in user's rows.
- Forms and API calls carry a CSRF token, so other websites can't act on your behalf.
- The session ID changes when you log in, and cookies are `HttpOnly` and `SameSite=Lax`.
- `.htaccess` blocks direct access to `config.php`, the SQL files and the `data/` folder (on Apache).
- Everything a user typed is escaped before it's shown on the page.

## Ideas for later

- "Forgot password" emails (needs an email service, for example PHPMailer with SMTP).
- Limiting login attempts per IP address.
- Editing a subject's name or exam date after creating it.
- Exporting expenses to CSV.
