<?php

declare(strict_types=1);

namespace App\Core;

use App\Exceptions\AppException;
use App\Exceptions\MethodNotAllowedException;
use App\Exceptions\RateLimitException;
use ErrorException;
use Throwable;

final class ErrorHandler
{
    private const FATAL = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];

    public function __construct(private readonly bool $debug, private readonly ?Logger $logger = null)
    {
    }

    public function register(): void
    {
        ini_set('display_errors', '0');
        error_reporting(E_ALL);
        set_error_handler(function (int $severity, string $message, string $file = '', int $line = 0): bool {
            if ((error_reporting() & $severity) === 0) {
                return false;
            }
            throw new ErrorException($message, 0, $severity, $file, $line);
        });
        set_exception_handler(function (Throwable $e): void {
            $this->render($e)->send();
        });
        register_shutdown_function(function (): void {
            $error = error_get_last();
            if ($error === null || !in_array($error['type'], self::FATAL, true)) {
                return;
            }
            $this->logger?->error('Fatal error', $error);
            if (!headers_sent()) {
                $this->render(new ErrorException($error['message'], 0, $error['type'], $error['file'], $error['line']))->send();
            }
        });
    }

    public function render(Throwable $e): Response
    {
        if ($e instanceof AppException) {
            $response = Response::error($e->errorCode(), $e->getMessage(), $e->status(), $e->fields());
            if ($e instanceof RateLimitException) {
                $response->setHeader('Retry-After', (string) $e->retryAfter());
            }
            if ($e instanceof MethodNotAllowedException) {
                $response->setHeader('Allow', implode(', ', $e->allowed()));
            }
            return $response;
        }

        $this->logger?->error($e->getMessage(), [
            'exception' => $e::class,
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString(),
        ]);

        $extra = [];
        if ($this->debug) {
            $extra['debug'] = [
                'exception' => $e::class,
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ];
        }
        return Response::error('SERVER_ERROR', 'Something went wrong on our side. Please try again later.', 500, [], $extra);
    }
}
