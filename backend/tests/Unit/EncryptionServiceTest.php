<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Exceptions\EncryptionException;
use App\Services\EncryptionService;
use PHPUnit\Framework\TestCase;

final class EncryptionServiceTest extends TestCase
{
    private function service(int $version = 1, array $previous = [], ?string $key = null): EncryptionService
    {
        return new EncryptionService($key ?? EncryptionService::generateKey(), $version, $previous);
    }

    public function testBinaryRoundTrip(): void
    {
        $service = $this->service();
        $plain = random_bytes(4096) . "%PDF-1.4\n";
        $sealed = $service->encrypt($plain);
        self::assertNotSame($plain, $sealed['ciphertext']);
        self::assertSame(12, strlen($sealed['iv']));
        self::assertSame(16, strlen($sealed['tag']));
        self::assertSame($plain, $service->decrypt($sealed['ciphertext'], $sealed['iv'], $sealed['tag'], $sealed['key_version']));
    }

    public function testTextRoundTripAndEnvelopeIsVersioned(): void
    {
        $service = $this->service(3);
        $envelope = $service->encryptText('Patient reports chest pain since Monday');
        self::assertStringStartsWith('dc:v3:', $envelope);
        self::assertStringNotContainsString('chest pain', $envelope);
        self::assertSame(3, $service->envelopeVersion($envelope));
        self::assertSame('Patient reports chest pain since Monday', $service->decryptText($envelope));
    }

    public function testEveryEncryptionUsesAFreshIv(): void
    {
        $service = $this->service();
        $ivs = [];
        $ciphertexts = [];
        for ($i = 0; $i < 50; $i++) {
            $sealed = $service->encrypt('same input');
            $ivs[] = bin2hex($sealed['iv']);
            $ciphertexts[] = bin2hex($sealed['ciphertext']);
        }
        self::assertCount(50, array_unique($ivs));
        self::assertCount(50, array_unique($ciphertexts));
        self::assertNotSame($service->encryptText('x'), $service->encryptText('x'));
    }

    public function testFlippedCiphertextByteIsDetected(): void
    {
        $service = $this->service();
        $sealed = $service->encrypt('confidential report body');
        $tampered = $sealed['ciphertext'];
        $tampered[0] = $tampered[0] ^ "\x01";
        $this->expectException(EncryptionException::class);
        $service->decrypt($tampered, $sealed['iv'], $sealed['tag'], $sealed['key_version']);
    }

    public function testWrongTagAndWrongIvAreDetected(): void
    {
        $service = $this->service();
        $sealed = $service->encrypt('confidential report body');
        foreach ([[$sealed['iv'], random_bytes(16)], [random_bytes(12), $sealed['tag']]] as [$iv, $tag]) {
            try {
                $service->decrypt($sealed['ciphertext'], $iv, $tag, $sealed['key_version']);
                self::fail('Tampering was not detected');
            } catch (EncryptionException) {
                self::addToAssertionCount(1);
            }
        }
    }

    public function testTamperedTextEnvelopeIsRejected(): void
    {
        $service = $this->service();
        $parts = explode(':', $service->encryptText('secret'));
        $cipher = base64_decode($parts[4]);
        $cipher[0] = $cipher[0] ^ "\x80";
        $parts[4] = base64_encode($cipher);
        $this->expectException(EncryptionException::class);
        $service->decryptText(implode(':', $parts));
    }

    public function testMalformedEnvelopeIsRejected(): void
    {
        $service = $this->service();
        $this->expectException(EncryptionException::class);
        $service->decryptText('not-an-envelope');
    }

    public function testWrongKeyCannotDecrypt(): void
    {
        $sealed = $this->service()->encrypt('secret');
        $this->expectException(EncryptionException::class);
        $this->service()->decrypt($sealed['ciphertext'], $sealed['iv'], $sealed['tag'], 1);
    }

    public function testKeyRotationKeepsOldDataReadable(): void
    {
        $oldKey = EncryptionService::generateKey();
        $old = new EncryptionService($oldKey, 1);
        $sealed = $old->encrypt('old file bytes');
        $envelope = $old->encryptText('old note');

        $rotated = new EncryptionService(EncryptionService::generateKey(), 2, [1 => $oldKey]);
        self::assertSame('old file bytes', $rotated->decrypt($sealed['ciphertext'], $sealed['iv'], $sealed['tag'], 1));
        self::assertSame('old note', $rotated->decryptText($envelope));
        self::assertSame(2, $rotated->encrypt('new')['key_version']);
        self::assertStringStartsWith('dc:v2:', $rotated->encryptText('new'));
    }

    public function testUnknownKeyVersionFails(): void
    {
        $service = $this->service(2);
        $this->expectException(EncryptionException::class);
        $service->decrypt('x', random_bytes(12), random_bytes(16), 9);
    }

    public function testInvalidKeysAreRejected(): void
    {
        foreach (['plain-text-key', 'base64:' . base64_encode('short'), 'base64:%%%'] as $key) {
            try {
                new EncryptionService($key);
                self::fail('Accepted an invalid key');
            } catch (EncryptionException) {
                self::addToAssertionCount(1);
            }
        }
    }

    public function testNullableHelpers(): void
    {
        $service = $this->service();
        self::assertNull($service->encryptNullable(null));
        self::assertNull($service->encryptNullable(''));
        self::assertNull($service->decryptNullable(null));
        self::assertSame('x', $service->decryptNullable($service->encryptNullable('x')));
    }
}
