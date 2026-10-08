<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Env;
use PHPUnit\Framework\TestCase;

final class EnvTest extends TestCase
{
    public function testBoolParsesTruthyValues(): void
    {
        $_ENV['DIAGNOCARE_TEST_FLAG'] = 'true';
        self::assertTrue(Env::bool('DIAGNOCARE_TEST_FLAG'));
        $_ENV['DIAGNOCARE_TEST_FLAG'] = '0';
        self::assertFalse(Env::bool('DIAGNOCARE_TEST_FLAG'));
        unset($_ENV['DIAGNOCARE_TEST_FLAG']);
    }

    public function testGetReturnsDefaultWhenMissing(): void
    {
        self::assertSame('fallback', Env::get('DIAGNOCARE_TEST_MISSING', 'fallback'));
    }

    public function testIntFallsBackForNonNumeric(): void
    {
        $_ENV['DIAGNOCARE_TEST_INT'] = 'abc';
        self::assertSame(30, Env::int('DIAGNOCARE_TEST_INT', 30));
        $_ENV['DIAGNOCARE_TEST_INT'] = '45';
        self::assertSame(45, Env::int('DIAGNOCARE_TEST_INT', 30));
        unset($_ENV['DIAGNOCARE_TEST_INT']);
    }
}
