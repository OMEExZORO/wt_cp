<?php

declare(strict_types=1);

namespace App\Core;

use PDO;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection === null) {
            self::$connection = self::create(Env::require('DB_PORT'));
        }
        return self::$connection;
    }

    public static function migrationConnection(): PDO
    {
        return self::create(Env::get('DB_MIGRATE_PORT') ?? Env::require('DB_PORT'));
    }

    public static function create(string $port): PDO
    {
        $dsn = sprintf(
            'pgsql:host=%s;port=%s;dbname=%s;sslmode=%s',
            Env::require('DB_HOST'),
            $port,
            Env::get('DB_NAME', 'postgres'),
            Env::get('DB_SSLMODE', 'prefer')
        );
        $pdo = new PDO($dsn, Env::require('DB_USER'), Env::require('DB_PASSWORD'), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => true,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        $pdo->exec("SET TIME ZONE 'Asia/Kolkata'");
        return $pdo;
    }

    public static function reset(): void
    {
        self::$connection = null;
    }
}
