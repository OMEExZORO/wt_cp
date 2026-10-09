<?php

declare(strict_types=1);

namespace App\Services\Reports;

use App\Exceptions\StorageException;
use App\Models\Referral;
use App\Models\Report;
use App\Models\ReportAccessLog;
use App\Services\EncryptionService;
use App\Services\Storage\StorageService;

final class ReportService
{
    public function __construct(
        private readonly Report $reports,
        private readonly Referral $referrals,
        private readonly ReportAccessLog $accessLog,
        private readonly StorageService $storage,
        private readonly EncryptionService $crypto
    ) {
    }

    public function store(array $user, array $appointment, array $upload, array $meta, ?string $ip, ?string $userAgent): string
    {
        $bytes = file_get_contents($upload['tmp_name']);
        if ($bytes === false || $bytes === '') {
            throw new StorageException('Could not read the uploaded file.');
        }
        $sealed = $this->crypto->encrypt($bytes);
        $path = self::randomPath();
        $status = $meta['status'];

        $this->storage->put($path, $sealed['ciphertext']);
        try {
            $row = $this->reports->transaction(function () use ($user, $appointment, $upload, $meta, $sealed, $path, $bytes, $status, $ip, $userAgent): array {
                $created = $this->reports->create([
                    'appointment_id' => $appointment['id'],
                    'patient_id' => $appointment['patient_id'],
                    'uploaded_by_user_id' => $user['id'],
                    'title' => $meta['title'],
                    'original_filename' => $upload['original_name'],
                    'storage_path' => $path,
                    'mime_type' => $upload['mime_type'],
                    'size_bytes' => $upload['size_bytes'],
                    'sha256' => hash('sha256', $bytes),
                    'encryption_iv' => base64_encode($sealed['iv']),
                    'encryption_tag' => base64_encode($sealed['tag']),
                    'key_version' => $sealed['key_version'],
                    'findings_encrypted' => $this->crypto->encryptNullable($meta['notes'] ?? null),
                    'impression_encrypted' => $this->crypto->encryptNullable($meta['impression'] ?? null),
                    'storage_driver' => $this->storage->driver(),
                    'status' => $status,
                    'released_at' => $status === 'draft' ? null : date(\DateTimeInterface::ATOM),
                ]);
                $this->accessLog->record((string) $created['id'], (string) $user['id'], 'upload', $ip, $userAgent);
                if ($status !== 'draft' && !empty($appointment['referral_id'])) {
                    $this->markReferralReady((string) $appointment['referral_id']);
                }
                return $created;
            });
        } catch (\Throwable $e) {
            try {
                $this->storage->delete($path);
            } catch (\Throwable) {
            }
            throw $e;
        }

        return (string) $row['id'];
    }

    public function update(array $existing, array $changes): void
    {
        $values = [];
        foreach (['title', 'status'] as $field) {
            if (array_key_exists($field, $changes)) {
                $values[$field] = $changes[$field];
            }
        }
        if (array_key_exists('notes', $changes)) {
            $values['findings_encrypted'] = $this->crypto->encryptNullable($changes['notes']);
        }
        if (array_key_exists('impression', $changes)) {
            $values['impression_encrypted'] = $this->crypto->encryptNullable($changes['impression']);
        }
        $released = isset($values['status']) && $values['status'] !== 'draft';
        if ($released && empty($existing['released_at'])) {
            $values['released_at'] = date(\DateTimeInterface::ATOM);
        }
        $this->reports->transaction(function () use ($existing, $values, $released): void {
            $this->reports->update((string) $existing['id'], $values);
            if ($released && !empty($existing['referral_id'])) {
                $this->markReferralReady((string) $existing['referral_id']);
            }
        });
    }

    public function read(array $report): string
    {
        $ciphertext = $this->storage->get((string) $report['storage_path']);
        $iv = base64_decode((string) $report['encryption_iv'], true);
        $tag = base64_decode((string) $report['encryption_tag'], true);
        if ($iv === false || $tag === false) {
            throw new StorageException('Stored encryption metadata is invalid.');
        }
        $plaintext = $this->crypto->decrypt($ciphertext, $iv, $tag, (int) $report['key_version']);
        if (!hash_equals((string) $report['sha256'], hash('sha256', $plaintext))) {
            throw new StorageException('Stored file failed its integrity check.');
        }
        return $plaintext;
    }

    public function remove(array $report): void
    {
        $this->storage->delete((string) $report['storage_path']);
        $this->reports->markDeleted((string) $report['id']);
    }

    public function storageDriver(): string
    {
        return $this->storage->driver();
    }

    public static function randomPath(): string
    {
        return sprintf('reports/%s/%s.bin', date('Y/m'), bin2hex(random_bytes(16)));
    }

    private function markReferralReady(string $referralId): void
    {
        $referral = $this->referrals->find($referralId);
        if ($referral === null || in_array($referral['status'], ['report_ready', 'declined', 'cancelled'], true)) {
            return;
        }
        $this->referrals->update($referralId, ['status' => 'report_ready', 'status_changed_at' => date(\DateTimeInterface::ATOM)]);
    }
}
