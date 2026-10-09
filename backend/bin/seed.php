<?php

declare(strict_types=1);

use App\Core\Database;
use App\Core\Env;

$paths = require dirname(__DIR__) . '/config/bootstrap.php';

$seedsDir = $paths['repo_root'] . '/database/seeds';
$mode = $argv[1] ?? '';
$modes = ['base', 'dev', 'demo', 'client', 'purge-demo', 'counts'];

function out(string $message): void
{
    fwrite(STDOUT, $message . PHP_EOL);
}

function fail(string $message): never
{
    fwrite(STDERR, 'ERROR: ' . $message . PHP_EOL);
    exit(1);
}

if (!in_array($mode, $modes, true)) {
    fail('Usage: php bin/seed.php <' . implode('|', $modes) . '>');
}

$isProduction = Env::get('APP_ENV', 'production') === 'production';
if (in_array($mode, ['dev', 'demo'], true) && $isProduction) {
    fail(sprintf('Seed mode "%s" is disabled when APP_ENV=production.', $mode));
}

try {
    $pdo = Database::migrationConnection();
} catch (Throwable $e) {
    fail('Could not connect to the database: ' . $e->getMessage());
}

$runSqlFile = static function (string $file) use ($pdo): void {
    $sql = file_get_contents($file);
    if ($sql === false || trim($sql) === '') {
        fail(sprintf('Seed file %s is empty or unreadable', basename($file)));
    }
    $pdo->beginTransaction();
    try {
        $pdo->exec($sql);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail(sprintf('Seed file %s failed and was rolled back: %s', basename($file), $e->getMessage()));
    }
    out(sprintf('Applied %s', basename($file)));
};

if ($mode === 'counts') {
    $tables = $pdo->query(
        "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname"
    )->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $table) {
        if (!preg_match('/^[a-z_]+$/', $table)) {
            continue;
        }
        $count = $pdo->query(sprintf('SELECT count(*) FROM "%s"', $table))->fetchColumn();
        out(sprintf('%-32s %s', $table, $count));
    }
    exit(0);
}

if ($mode === 'purge-demo') {
    $deleted = $pdo->exec('DELETE FROM reviews WHERE is_demo = TRUE');
    out(sprintf('Removed %d demo review(s).', (int) $deleted));
    exit(0);
}

$runSqlFile($seedsDir . '/seed_base.sql');

if ($mode === 'dev') {
    $devSeed = require $seedsDir . '/seed_dev.php';
    $pdo->beginTransaction();
    try {
        $result = $devSeed($pdo);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Dev seed failed and was rolled back: ' . $e->getMessage());
    }
    out(sprintf('Applied seed_dev.php (%d users, %d new slots)', $result['users'], $result['slots_inserted']));
}

if ($mode === 'client') {
    $runSqlFile($seedsDir . '/seed_client.sql');
}

if ($mode === 'demo') {
    $runSqlFile($seedsDir . '/seed_demo.sql');
}

out('Seeding complete.');
