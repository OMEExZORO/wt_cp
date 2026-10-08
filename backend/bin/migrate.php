<?php

declare(strict_types=1);

use App\Core\Database;

$paths = require dirname(__DIR__) . '/config/bootstrap.php';

$migrationsDir = $paths['repo_root'] . '/database/migrations';
$statusOnly = in_array('--status', $argv, true);

function out(string $message): void
{
    fwrite(STDOUT, $message . PHP_EOL);
}

function fail(string $message): never
{
    fwrite(STDERR, 'ERROR: ' . $message . PHP_EOL);
    exit(1);
}

try {
    $pdo = Database::migrationConnection();
} catch (Throwable $e) {
    fail('Could not connect to the database: ' . $e->getMessage());
}

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )'
);
$pdo->exec('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');

$files = glob($migrationsDir . '/*.sql') ?: [];
sort($files, SORT_STRING);

$applied = [];
foreach ($pdo->query('SELECT filename, checksum FROM schema_migrations ORDER BY filename') as $row) {
    $applied[$row['filename']] = $row['checksum'];
}

$pending = [];
foreach ($files as $file) {
    $name = basename($file);
    if (!preg_match('/^\d{3}_[a-z0-9_]+\.sql$/', $name)) {
        fail(sprintf('Migration file %s does not match NNN_snake_case.sql', $name));
    }
    $checksum = hash_file('sha256', $file);
    if (isset($applied[$name])) {
        if ($applied[$name] !== $checksum) {
            out(sprintf('WARNING: %s was modified after it was applied. Create a new migration instead.', $name));
        }
        if ($statusOnly) {
            out(sprintf('[applied] %s', $name));
        }
        continue;
    }
    $pending[] = ['name' => $name, 'path' => $file, 'checksum' => $checksum];
    if ($statusOnly) {
        out(sprintf('[pending] %s', $name));
    }
}

if ($statusOnly) {
    exit(0);
}

if ($pending === []) {
    out('Nothing to migrate. Database is up to date.');
    exit(0);
}

$pdo->query('SELECT pg_advisory_lock(727001)');

try {
    foreach ($pending as $migration) {
        $sql = file_get_contents($migration['path']);
        if ($sql === false || trim($sql) === '') {
            fail(sprintf('Migration %s is empty or unreadable', $migration['name']));
        }
        $pdo->beginTransaction();
        try {
            $pdo->exec($sql);
            $record = $pdo->prepare('INSERT INTO schema_migrations (filename, checksum) VALUES (:filename, :checksum)');
            $record->execute(['filename' => $migration['name'], 'checksum' => $migration['checksum']]);
            $pdo->commit();
            out(sprintf('Applied %s', $migration['name']));
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            fail(sprintf('Migration %s failed and was rolled back: %s', $migration['name'], $e->getMessage()));
        }
    }
} finally {
    $pdo->query('SELECT pg_advisory_unlock(727001)');
}

out(sprintf('Done. %d migration(s) applied.', count($pending)));
