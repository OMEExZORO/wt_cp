<?php

declare(strict_types=1);

use App\Core\Database;
use App\Services\EncryptionService;
use App\Services\Reports\ReportService;
use App\Services\Storage\LocalStorage;
use App\Services\Storage\SupabaseStorage;
use App\Core\Env;

require dirname(__DIR__) . '/config/bootstrap.php';

$apply = in_array('--apply', $argv, true);
$crypto = EncryptionService::fromEnv();
$current = $crypto->currentVersion();
$pdo = Database::migrationConnection();

$storage = Env::get('STORAGE_DRIVER', 'local') === 'supabase'
    ? new SupabaseStorage(Env::require('SUPABASE_URL'), Env::require('SUPABASE_SERVICE_KEY'), Env::get('STORAGE_BUCKET', 'reports'))
    : new LocalStorage(dirname(__DIR__) . '/storage/reports');

$files = 0;
$texts = 0;

$rows = $pdo->prepare('SELECT id, storage_path, encryption_iv, encryption_tag, key_version, findings_encrypted, impression_encrypted, storage_driver FROM reports WHERE deleted_at IS NULL');
$rows->execute();
foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $updates = [];
    if ((int) $row['key_version'] !== $current && $row['storage_driver'] === $storage->driver()) {
        $iv = base64_decode((string) $row['encryption_iv'], true);
        $tag = base64_decode((string) $row['encryption_tag'], true);
        $plain = $crypto->decrypt($storage->get((string) $row['storage_path']), (string) $iv, (string) $tag, (int) $row['key_version']);
        $sealed = $crypto->encrypt($plain);
        $newPath = ReportService::randomPath();
        if ($apply) {
            $storage->put($newPath, $sealed['ciphertext']);
            $updates = [
                'storage_path' => $newPath,
                'encryption_iv' => base64_encode($sealed['iv']),
                'encryption_tag' => base64_encode($sealed['tag']),
                'key_version' => $sealed['key_version'],
            ];
        }
        $files++;
    }
    foreach (['findings_encrypted', 'impression_encrypted'] as $column) {
        $value = $row[$column];
        if ($value !== null && $crypto->envelopeVersion((string) $value) !== $current) {
            if ($apply) {
                $updates[$column] = $crypto->encryptText($crypto->decryptText((string) $value));
            }
            $texts++;
        }
    }
    if ($updates !== []) {
        $set = implode(', ', array_map(static fn (string $c): string => $c . ' = :' . $c, array_keys($updates)));
        $pdo->prepare('UPDATE reports SET ' . $set . ' WHERE id = :id')->execute($updates + ['id' => $row['id']]);
        if (isset($updates['storage_path'])) {
            $storage->delete((string) $row['storage_path']);
        }
    }
}

$referrals = $pdo->query('SELECT id, clinical_notes_encrypted FROM referrals WHERE clinical_notes_encrypted IS NOT NULL')->fetchAll(PDO::FETCH_ASSOC);
foreach ($referrals as $row) {
    if ($crypto->envelopeVersion((string) $row['clinical_notes_encrypted']) !== $current) {
        if ($apply) {
            $pdo->prepare('UPDATE referrals SET clinical_notes_encrypted = :value WHERE id = :id')
                ->execute(['value' => $crypto->encryptText($crypto->decryptText((string) $row['clinical_notes_encrypted'])), 'id' => $row['id']]);
        }
        $texts++;
    }
}

fwrite(STDOUT, sprintf(
    "%s: %d file(s) and %d text value(s) %s key version %d.\n",
    $apply ? 'Applied' : 'Dry run',
    $files,
    $texts,
    $apply ? 're-encrypted to' : 'would be re-encrypted to',
    $current
));
