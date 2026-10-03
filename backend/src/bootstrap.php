<?php

declare(strict_types=1);

use DiagnoCare\Core\Config;
use DiagnoCare\Core\Env;

date_default_timezone_set('Asia/Kolkata');
mb_internal_encoding('UTF-8');

spl_autoload_register(static function (string $class): void {
    $prefix = 'DiagnoCare\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

Env::load(dirname(__DIR__) . '/.env');
Config::set(require dirname(__DIR__) . '/config/config.php');

ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', (string) Config::get('log_path'));
error_reporting(E_ALL);
