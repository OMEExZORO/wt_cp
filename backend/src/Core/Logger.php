<?php

declare(strict_types=1);

namespace App\Core;

final class Logger
{
    public function __construct(private readonly string $path)
    {
    }

    public function info(string $message, array $context = []): void
    {
        $this->write('INFO', $message, $context);
    }

    public function warning(string $message, array $context = []): void
    {
        $this->write('WARNING', $message, $context);
    }

    public function error(string $message, array $context = []): void
    {
        $this->write('ERROR', $message, $context);
    }

    private function write(string $level, string $message, array $context): void
    {
        $directory = dirname($this->path);
        if (!is_dir($directory) && !@mkdir($directory, 0775, true) && !is_dir($directory)) {
            return;
        }
        $line = sprintf(
            "[%s] %s %s %s\n",
            date('c'),
            $level,
            str_replace(["\r", "\n"], ' ', $message),
            $context === [] ? '' : json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR)
        );
        @file_put_contents($this->path, $line, FILE_APPEND | LOCK_EX);
    }
}
