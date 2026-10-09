<?php

declare(strict_types=1);

namespace App\Services\Alerts;

use App\Core\Logger;

final class StubSmsGateway implements SmsGateway
{
    public function __construct(private readonly Logger $logger)
    {
    }

    public function send(string $phone, string $message): bool
    {
        $this->logger->info('sms.stub', ['to_last4' => substr($phone, -4), 'length' => strlen($message)]);
        return true;
    }
}
