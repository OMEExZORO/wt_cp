<?php

declare(strict_types=1);

use DiagnoCare\Core\Csrf;
use DiagnoCare\Core\HttpException;
use DiagnoCare\Core\Request;
use DiagnoCare\Core\Response;
use DiagnoCare\Core\Router;
use DiagnoCare\Core\Session;

require dirname(__DIR__) . '/src/bootstrap.php';

Response::securityHeaders();

set_exception_handler(static function (Throwable $e): void {
    if ($e instanceof HttpException) {
        Response::error($e->status(), $e->getMessage(), $e->errors(), $e->extra());
    }
    error_log(sprintf('[%s] %s in %s:%d', get_class($e), $e->getMessage(), $e->getFile(), $e->getLine()));
    Response::error(500, 'Something went wrong on our side. Please try again later.');
});

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

$request = Request::capture();
Session::start();
Csrf::verify($request);

$router = new Router();
(require dirname(__DIR__) . '/src/routes.php')($router);
$router->dispatch($request);
