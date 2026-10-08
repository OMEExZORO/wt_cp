<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Validation\Sanitizer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SanitizerTest extends TestCase
{
    private Sanitizer $sanitizer;

    protected function setUp(): void
    {
        $this->sanitizer = new Sanitizer();
    }

    public static function sqlPayloads(): array
    {
        return [
            'classic tautology' => ["' OR '1'='1"],
            'tautology with comment' => ["admin' OR 1=1 --"],
            'drop table' => ["'; DROP TABLE users;--"],
            'union select' => ['1 UNION SELECT password_hash FROM users'],
            'union all select' => ['x UNION ALL SELECT null, null'],
            'stacked comment' => ['abc; -- comment'],
            'numeric tautology' => ['1 or 1=1'],
            'time based' => ["1' AND pg_sleep(5)"],
            'inline comment' => ['name/**/OR/**/1=1'],
            'delete from' => ['x; DELETE FROM appointments'],
            'url encoded' => ['%27%20OR%20%271%27%3D%271'],
        ];
    }

    public static function htmlPayloads(): array
    {
        return [
            'script tag' => ['<script>alert(1)</script>'],
            'img onerror' => ['<img src=x onerror=alert(1)>'],
            'svg onload' => ['<svg/onload=alert(1)>'],
            'javascript url' => ['javascript:alert(document.cookie)'],
            'event handler without tag' => ['" onmouseover="alert(1)'],
            'encoded entity' => ['&#60;script&#62;'],
            'closing tag' => ['</textarea><b>x</b>'],
        ];
    }

    public static function safeValues(): array
    {
        return [
            'apostrophe name' => ["Asha D'Souza"],
            'hyphen name' => ['Mary-Jane O\'Neil'],
            'address' => ['Nagdev Tower, Pune Nashik Road, Bhosari, Pune 411039'],
            'clinical text' => ['Pain in the lower abdomen for 3 days, worse after meals'],
            'select word' => ['Please select a morning slot'],
            'comparison text' => ['BP < 120 and sugar > 90'],
            'devanagari' => ['मेघनाद पडसलगीकर'],
            'or in sentence' => ['Fasting or full bladder required'],
        ];
    }

    #[DataProvider('sqlPayloads')]
    public function testDetectsSqlInjectionPatterns(string $payload): void
    {
        self::assertSame(Sanitizer::THREAT_SQL, $this->sanitizer->detectThreat($payload));
    }

    #[DataProvider('htmlPayloads')]
    public function testDetectsHtmlAndScriptPayloads(string $payload): void
    {
        self::assertSame(Sanitizer::THREAT_HTML, $this->sanitizer->detectThreat($payload));
    }

    #[DataProvider('safeValues')]
    public function testAllowsOrdinaryText(string $value): void
    {
        self::assertNull($this->sanitizer->detectThreat($value));
    }

    public function testRejectsInvalidUtf8(): void
    {
        self::assertSame(Sanitizer::THREAT_ENCODING, $this->sanitizer->detectThreat("abc\xC3\x28"));
    }

    public function testCleanTrimsAndCollapsesWhitespace(): void
    {
        self::assertSame('Asha Patil', $this->sanitizer->clean("  Asha \t\n  Patil  "));
    }

    public function testCleanStripsControlAndZeroWidthCharacters(): void
    {
        self::assertSame('abc', $this->sanitizer->clean("a\x00b\u{200B}c\x07"));
    }

    public function testCleanKeepsLineBreaksInMultilineMode(): void
    {
        self::assertSame("Line one\n\nLine two", $this->sanitizer->clean("  Line   one \r\n\r\n\r\n\r\n Line two  ", true));
    }

    public function testEscapeEncodesHtml(): void
    {
        self::assertSame('&lt;b&gt;&quot;x&quot;&amp;&#039;', Sanitizer::escape('<b>"x"&\''));
    }
}
