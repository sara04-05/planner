<?php
// Sending email through Gmail, used for the "confirm your email" codes.
// Needs GMAIL_USER and GMAIL_APP_PASSWORD in config.php (see README). Without them sign-up skips the check.
declare(strict_types=1);

function mail_configured(): bool
{
    return defined('GMAIL_USER') && GMAIL_USER !== '' && defined('GMAIL_APP_PASSWORD') && GMAIL_APP_PASSWORD !== '';
}

/** Send a plain-text email with Gmail's SMTP server. Throws RuntimeException if Gmail refuses it. */
function send_mail(string $to, string $subject, string $text): void
{
    $fp = @stream_socket_client('ssl://smtp.gmail.com:465', $errno, $errstr, 15);
    if (!$fp) throw new RuntimeException("Couldn't reach Gmail ($errstr).");
    stream_set_timeout($fp, 15);

    // Read one reply (can be several lines) and check its code
    $expect = function (int $code) use ($fp): void {
        $reply = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $reply .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        if ((int)substr($reply, 0, 3) !== $code) throw new RuntimeException('Gmail said: ' . trim($reply));
    };
    $say = function (string $cmd, int $code) use ($fp, $expect): void {
        fwrite($fp, $cmd . "\r\n");
        $expect($code);
    };

    $pass = str_replace(' ', '', GMAIL_APP_PASSWORD);   // Google shows app passwords in groups of four
    $name = defined('MAIL_FROM_NAME') ? MAIL_FROM_NAME : 'Splanner';
    $body = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], "\n", $text));
    $msg = implode("\r\n", [
        'From: =?UTF-8?B?' . base64_encode($name) . '?= <' . GMAIL_USER . '>',
        'To: <' . $to . '>',
        'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
        'Date: ' . date(DATE_RFC2822),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . substr(strrchr(GMAIL_USER, '@'), 1) . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        str_replace("\n", "\r\n", $body),
    ]);

    try {
        $expect(220);
        $say('EHLO splanner', 250);
        $say('AUTH LOGIN', 334);
        $say(base64_encode(GMAIL_USER), 334);
        $say(base64_encode($pass), 235);
        $say('MAIL FROM:<' . GMAIL_USER . '>', 250);
        $say('RCPT TO:<' . $to . '>', 250);
        $say('DATA', 354);
        $say($msg . "\r\n.", 250);
        fwrite($fp, "QUIT\r\n");
    } finally {
        fclose($fp);
    }
}

/** Email a new 6-digit code to the user. Returns an error message for the page, or '' when it was sent. */
function send_verify_code(int $uid, string $email, string $name): string
{
    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    q('DELETE FROM email_codes WHERE user_id = ?', [$uid]);
    q('INSERT INTO email_codes (user_id, code_hash, expires_at, sent_at, tries) VALUES (?, ?, ?, ?, 0)',
        [$uid, password_hash($code, PASSWORD_DEFAULT), time() + 30 * 60, time()]);
    try {
        send_mail($email, "Your Splanner code: $code",
            "Hi $name,\n\nYour code to confirm your email is:\n\n    $code\n\n"
            . "Type it on the Splanner page to finish creating your account. It works for 30 minutes.\n\n"
            . "If you didn't sign up for Splanner, you can ignore this email.\n");
    } catch (RuntimeException $e) {
        error_log('Verify email: ' . $e->getMessage());
        q('UPDATE email_codes SET sent_at = 0 WHERE user_id = ?', [$uid]);   // nothing arrived, so no need to wait before trying again
        return preg_match('/said: 55\d/', $e->getMessage())   // 550/553: Gmail rejected the address
            ? "We couldn't send an email to $email. Check that the address is right."
            : "We couldn't send the email right now. Try \"Send a new code\" in a minute.";
    }
    return '';
}
