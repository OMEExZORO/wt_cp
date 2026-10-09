<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Env;
use App\Exceptions\EncryptionException;

final class EncryptionService
{
    public const CIPHER = 'aes-256-gcm';
    public const IV_BYTES = 12;
    public const TAG_BYTES = 16;
    private const ENVELOPE_PREFIX = 'dc';

    private array $keys = [];

    public function __construct(string $currentKey, private readonly int $currentVersion = 1, array $previousKeys = [])
    {
        if ($currentVersion < 1 || $currentVersion > 32767) {
            throw new EncryptionException('Invalid encryption key version.');
        }
        $this->keys[$currentVersion] = self::parseKey($currentKey);
        foreach ($previousKeys as $version => $key) {
            $version = (int) $version;
            if ($version < 1 || $version === $currentVersion) {
                throw new EncryptionException('Invalid previous encryption key version.');
            }
            $this->keys[$version] = self::parseKey((string) $key);
        }
    }

    public static function fromEnv(): self
    {
        $previous = [];
        foreach (array_filter(array_map('trim', explode(',', (string) Env::get('ENCRYPTION_KEYS_PREVIOUS', '')))) as $pair) {
            $parts = explode('=', $pair, 2);
            if (count($parts) !== 2 || !ctype_digit($parts[0])) {
                throw new EncryptionException('ENCRYPTION_KEYS_PREVIOUS must look like 1=base64:...,2=base64:...');
            }
            $previous[(int) $parts[0]] = $parts[1];
        }
        return new self(Env::require('ENCRYPTION_KEY'), Env::int('ENCRYPTION_KEY_VERSION', 1), $previous);
    }

    public static function generateKey(): string
    {
        return 'base64:' . base64_encode(random_bytes(32));
    }

    public function currentVersion(): int
    {
        return $this->currentVersion;
    }

    public function hasVersion(int $version): bool
    {
        return isset($this->keys[$version]);
    }

    public function encrypt(string $plaintext, string $aad = ''): array
    {
        $iv = random_bytes(self::IV_BYTES);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, self::CIPHER, $this->keys[$this->currentVersion], OPENSSL_RAW_DATA, $iv, $tag, $aad, self::TAG_BYTES);
        if ($ciphertext === false || strlen($tag) !== self::TAG_BYTES) {
            throw new EncryptionException('Encryption failed.');
        }
        return ['ciphertext' => $ciphertext, 'iv' => $iv, 'tag' => $tag, 'key_version' => $this->currentVersion];
    }

    public function decrypt(string $ciphertext, string $iv, string $tag, int $keyVersion, string $aad = ''): string
    {
        $key = $this->keys[$keyVersion] ?? throw new EncryptionException('Unknown encryption key version.');
        if (strlen($iv) !== self::IV_BYTES || strlen($tag) !== self::TAG_BYTES) {
            throw new EncryptionException('Malformed encrypted payload.');
        }
        $plaintext = openssl_decrypt($ciphertext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv, $tag, $aad);
        if ($plaintext === false) {
            throw new EncryptionException('Decryption failed: data was altered or the key is wrong.');
        }
        return $plaintext;
    }

    public function encryptText(string $plaintext): string
    {
        $sealed = $this->encrypt($plaintext);
        return implode(':', [
            self::ENVELOPE_PREFIX,
            'v' . $sealed['key_version'],
            base64_encode($sealed['iv']),
            base64_encode($sealed['tag']),
            base64_encode($sealed['ciphertext']),
        ]);
    }

    public function decryptText(string $envelope): string
    {
        $parts = explode(':', $envelope);
        if (count($parts) !== 5 || $parts[0] !== self::ENVELOPE_PREFIX || preg_match('/^v(\d+)$/', $parts[1], $match) !== 1) {
            throw new EncryptionException('Malformed encrypted payload.');
        }
        $iv = base64_decode($parts[2], true);
        $tag = base64_decode($parts[3], true);
        $ciphertext = base64_decode($parts[4], true);
        if ($iv === false || $tag === false || $ciphertext === false) {
            throw new EncryptionException('Malformed encrypted payload.');
        }
        return $this->decrypt($ciphertext, $iv, $tag, (int) $match[1]);
    }

    public function encryptNullable(?string $plaintext): ?string
    {
        return $plaintext === null || $plaintext === '' ? null : $this->encryptText($plaintext);
    }

    public function decryptNullable(?string $envelope): ?string
    {
        return $envelope === null || $envelope === '' ? null : $this->decryptText($envelope);
    }

    public function envelopeVersion(string $envelope): ?int
    {
        return preg_match('/^dc:v(\d+):/', $envelope, $match) === 1 ? (int) $match[1] : null;
    }

    private static function parseKey(string $key): string
    {
        if (!str_starts_with($key, 'base64:')) {
            throw new EncryptionException('Encryption key must start with base64:.');
        }
        $raw = base64_decode(substr($key, 7), true);
        if ($raw === false || strlen($raw) !== 32) {
            throw new EncryptionException('Encryption key must be 32 bytes, base64 encoded.');
        }
        return $raw;
    }
}
