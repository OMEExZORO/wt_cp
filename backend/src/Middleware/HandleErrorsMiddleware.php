<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\ErrorHandler;
use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;
use Throwable;

final class HandleErrorsMiddleware implements Middleware
{
    public function __construct(private readonly ErrorHandler $errors)
    {
    }

    public function handle(Request $request, callable $next, string ...$params): Response
    {
        try {
            return $next($request);
        } catch (Throwable $e) {
            return $this->errors->render($e);
        }
    }
}
