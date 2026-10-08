<?php

declare(strict_types=1);

namespace App\Services\Mail;

final class MailMessage
{
    public function __construct(
        public readonly string $to,
        public readonly string $toName,
        public readonly string $subject,
        public readonly string $html,
        public readonly string $text,
        public readonly array $attachments = []
    ) {
    }
}
