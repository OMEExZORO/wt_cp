<?php

declare(strict_types=1);

namespace DiagnoCare\Core;

use finfo;
use RuntimeException;

final class FileVault
{
    private const CIPHER = 'aes-256-gcm';

    public const ALLOWED = [
        'application/pdf' => ['ext' => ['pdf'], 'magic' => ["%PDF-"]],
        'image/jpeg' => ['ext' => ['jpg', 'jpeg'], 'magic' => ["\xFF\xD8\xFF"]],
    ];

    public static function inspectUpload(?array $file): array
    {
        if ($file === null || !isset($file['error'], $file['tmp_name'], $file['size'], $file['name'])) {
            throw new HttpException(422, 'Please choose a file to upload.', ['file' => 'A PDF or JPG file is required.']);
        }
        $maxBytes = (int) Config::get('reports.max_bytes');
        $error = (int) $file['error'];
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            throw new HttpException(422, 'File too large.', ['file' => 'Maximum allowed size is ' . self::humanSize($maxBytes) . '.']);
        }
        if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            throw new HttpException(422, 'Upload failed.', ['file' => 'The file could not be uploaded. Please try again.']);
        }

        $size = (int) filesize($file['tmp_name']);
        if ($size <= 0 || $size > $maxBytes) {
            throw new HttpException(422, 'File too large.', ['file' => 'File must be between 1 byte and ' . self::humanSize($maxBytes) . '.']);
        }

        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (!is_string($mime) || !isset(self::ALLOWED[$mime])) {
            throw new HttpException(422, 'Invalid file type.', ['file' => 'Only PDF and JPG files are accepted.']);
        }

        $handle = fopen($file['tmp_name'], 'rb');
        $head = $handle ? (string) fread($handle, 8) : '';
        if ($handle) {
            fclose($handle);
        }
        $magicOk = false;
        foreach (self::ALLOWED[$mime]['magic'] as $magic) {
            if (str_starts_with($head, $magic)) {
                $magicOk = true;
            }
        }
        if (!$magicOk) {
            throw new HttpException(422, 'Invalid file type.', ['file' => 'File contents do not match a PDF or JPG.']);
        }

        if ($mime === 'image/jpeg' && @getimagesize($file['tmp_name']) === false) {
            throw new HttpException(422, 'Invalid image.', ['file' => 'The JPG image appears to be corrupted.']);
        }

        $ext = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, self::ALLOWED[$mime]['ext'], true)) {
            throw new HttpException(422, 'Invalid file extension.', ['file' => 'File extension does not match its contents.']);
        }

        $original = preg_replace('/[^\p{L}\p{N} ._-]/u', '_', basename((string) $file['name'])) ?? 'report';
        $original = mb_substr($original, 0, 200);

        return [
            'tmp_name' => $file['tmp_name'],
            'mime' => $mime,
            'size' => $size,
            'original_name' => $original,
            'extension' => self::ALLOWED[$mime]['ext'][0],
        ];
    }

    public static function store(string $sourcePath, string $extension): array
    {
        $plain = file_get_contents($sourcePath);
        if ($plain === false) {
            throw new RuntimeException('Unable to read uploaded file.');
        }
        $iv = random_bytes(12);
        $tag = '';
        $cipherText = openssl_encrypt($plain, self::CIPHER, self::key(), OPENSSL_RAW_DATA, $iv, $tag, '', 16);
        if ($cipherText === false) {
            throw new RuntimeException('Encryption failed.');
        }

        $storedName = bin2hex(random_bytes(32)) . '.enc';
        $dir = self::directory();
        $target = $dir . DIRECTORY_SEPARATOR . $storedName;
        if (file_put_contents($target, $cipherText, LOCK_EX) === false) {
            throw new RuntimeException('Unable to write encrypted file.');
        }
        @chmod($target, 0600);
        @unlink($sourcePath);

        return [
            'stored_name' => $storedName,
            'iv' => $iv,
            'tag' => $tag,
            'sha256' => hash('sha256', $plain),
            'cipher' => self::CIPHER,
        ];
    }

    public static function read(string $storedName, string $iv, string $tag, string $expectedSha): string
    {
        if (!preg_match('/^[a-f0-9]{64}\.enc$/', $storedName)) {
            throw new RuntimeException('Invalid stored file name.');
        }
        $path = self::directory() . DIRECTORY_SEPARATOR . $storedName;
        $cipherText = is_file($path) ? file_get_contents($path) : false;
        if ($cipherText === false) {
            throw new HttpException(404, 'Report file is missing. Please contact the clinic.');
        }
        $plain = openssl_decrypt($cipherText, self::CIPHER, self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        if ($plain === false || !hash_equals($expectedSha, hash('sha256', $plain))) {
            throw new RuntimeException('Report integrity check failed for ' . $storedName);
        }
        return $plain;
    }

    public static function delete(string $storedName): void
    {
        if (preg_match('/^[a-f0-9]{64}\.enc$/', $storedName)) {
            @unlink(self::directory() . DIRECTORY_SEPARATOR . $storedName);
        }
    }

    private static function key(): string
    {
        $encoded = (string) Config::get('reports.key');
        $key = base64_decode($encoded, true);
        if ($key === false || strlen($key) !== 32) {
            throw new RuntimeException('REPORT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
        }
        return $key;
    }

    private static function directory(): string
    {
        $dir = rtrim((string) Config::get('reports.path'), '/\\');
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('Report storage directory is not available.');
        }
        $publicRoot = realpath(dirname(__DIR__, 2) . '/public');
        $real = realpath($dir);
        if ($real === false || ($publicRoot !== false && str_starts_with($real . DIRECTORY_SEPARATOR, $publicRoot . DIRECTORY_SEPARATOR))) {
            throw new RuntimeException('Report storage must be outside the web root.');
        }
        return $real;
    }

    private static function humanSize(int $bytes): string
    {
        return round($bytes / 1048576, 1) . ' MB';
    }
}
