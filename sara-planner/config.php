<?php
// ------------------------------------------------------------
// Splanner: settings
// Change these to match your database. The defaults work with XAMPP.
// ------------------------------------------------------------

// "mysql" for XAMPP / real hosting, or "sqlite" to run without MySQL
// (SQLite creates data/planner.sqlite automatically).
// Each setting can also come from an environment variable (used by Docker); the defaults work with XAMPP.
define('DB_DRIVER', getenv('DB_DRIVER') ?: 'mysql');

// MySQL / MariaDB
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', (int)(getenv('DB_PORT') ?: 3306));
define('DB_NAME', getenv('DB_NAME') ?: 'sara_planner');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : '');   // XAMPP's root user has no password by default

// SQLite
const SQLITE_PATH = __DIR__ . '/data/planner.sqlite';

// Emails of the accounts that may open admin.php (the list of all users).
// Put the email you log in to the website with, e.g. ['you@example.com'].
define('ADMIN_EMAILS', array_filter(array_map('trim', explode(',', getenv('ADMIN_EMAILS') ?: ''))));

// ---- Google Calendar (optional) ----
// Lets people send their "Hour by hour" plan to their Google Calendar.
// Make a free OAuth client in the Google Cloud console and paste it here (steps in README.md).
// Leave empty to hide the Google Calendar button.
const GOOGLE_CLIENT_ID     = '';
const GOOGLE_CLIENT_SECRET = '';
// Leave empty to work it out automatically (e.g. http://localhost/sara-planner/calendar.php)
const GOOGLE_REDIRECT_URI  = '';

// ---- Confirm emails with Gmail (optional) ----
// New accounts get a 6-digit code by email, so a mistyped email is caught right away.
// Use a Gmail address and an "app password" for it (steps in README.md), not your normal password.
// Leave empty to skip the check.
const GMAIL_USER         = '';   // e.g. 'splanner.app@gmail.com'
const GMAIL_APP_PASSWORD = '';   // the 16-letter app password
const MAIL_FROM_NAME     = 'Splanner';

// ---- Spotify music player (optional) ----
// Lets people connect their own Spotify account on the Music page. One Client ID serves everyone; nobody needs their own code.
// Make an app at developer.spotify.com/dashboard and paste its Client ID and Client secret here (steps in README.md).
// Leave empty and the Music page still plays any Spotify link you paste.
const SPOTIFY_CLIENT_ID     = '';
const SPOTIFY_CLIENT_SECRET = '';
// Leave empty to work it out automatically (e.g. https://your-site/music.php). Must match the dashboard exactly.
const SPOTIFY_REDIRECT_URI  = '';

// Your time zone, so "today" is right
date_default_timezone_set('Europe/Tirane');
