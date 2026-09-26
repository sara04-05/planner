<?php
// ------------------------------------------------------------
// Splanner: settings
// Change these to match your database. The defaults work with XAMPP.
// ------------------------------------------------------------

// "mysql" for XAMPP / real hosting, or "sqlite" to run without MySQL
// (SQLite creates data/planner.sqlite automatically).
const DB_DRIVER = 'mysql';

// MySQL / MariaDB
const DB_HOST = '127.0.0.1';
const DB_PORT = 3306;
const DB_NAME = 'sara_planner';
const DB_USER = 'root';
const DB_PASS = '';          // XAMPP's root user has no password by default

// SQLite
const SQLITE_PATH = __DIR__ . '/data/planner.sqlite';

// Your time zone, so "today" is right
date_default_timezone_set('Europe/Belgrade');
