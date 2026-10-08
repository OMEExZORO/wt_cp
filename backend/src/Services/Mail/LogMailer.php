<?php

declare(strict_types=1);

namespace App\Services\Mail;

final class LogMailer implements Mailer
{
    public function __construct(private readonly string $path, private readonly string $from)
    {
    }

    public function send(MailMessage $message): void
    {
        $directory = dirname($this->path);
        if (!is_dir($directory)) {
            @mkdir($directory, 0775, true);
        }
        $entry = implode("\n", [
            str_repeat('=', 72),
            'Date: ' . date('c'),
            'From: ' . $this->from,
            'To: ' . $message->toName . ' <' . $message->to . '>',
            'Subject: ' . $message->subject,
            'Attachments: ' . count($message->attachments),
            '',
            $message->text,
            '',
        ]);
        if (@file_put_contents($this->path, $entry . "\n", FILE_APPEND | LOCK_EX) === false) {
            throw new \RuntimeException('Could not write to the mail log');
        }
    }
}
