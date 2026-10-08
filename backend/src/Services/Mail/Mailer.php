<?php

declare(strict_types=1);

namespace App\Services\Mail;

interface Mailer
{
    public function send(MailMessage $message): void;
}
