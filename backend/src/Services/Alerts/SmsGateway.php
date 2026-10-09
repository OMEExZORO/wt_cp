<?php

declare(strict_types=1);

namespace App\Services\Alerts;

interface SmsGateway
{
    public function send(string $phone, string $message): bool;
}
