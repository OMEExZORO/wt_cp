<?php

declare(strict_types=1);

namespace App\Validation;

final class Sanitizer
{
    public const THREAT_SQL = 'sqli';
    public const THREAT_HTML = 'xss';
    public const THREAT_ENCODING = 'encoding';

    private const SQL_PATTERNS = [
        '/\'\s*(?:or|and)\s+\'?[\w\s]*\'?\s*(?:=|<|>|like\b)/i',
        '/\b(?:or|and)\s+\'?\d+\'?\s*=\s*\'?\d+/i',
        '/\'\s*(?:;|--|#|\/\*)/',
        '/;\s*(?:--|#|\/\*)/',
        '/\b(?:drop|truncate|alter|create)\s+(?:table|database|schema|user|role|function|view)\b/i',
        '/\bunion\b(?:\s+all|\s+distinct)?\s+select\b/i',
        '/\binsert\s+into\b/i',
        '/\bdelete\s+from\b/i',
        '/\bupdate\s+\w+\s+set\b/i',
        '/\bselect\b[\s\S]{0,80}\bfrom\s+(?:users|pg_\w+|information_schema)\b/i',
        '/\b(?:pg_sleep|benchmark)\s*\(/i',
        '/\bsleep\s*\(\s*\d+\s*\)/i',
        '/\bwaitfor\s+delay\b/i',
        '/\bexec(?:ute)?\s+(?:xp_|sp_)\w+/i',
        '/\b(?:information_schema|pg_catalog|pg_shadow)\b/i',
        '/\/\*[\s\S]*?\*\//',
    ];

    private const HTML_PATTERNS = [
        '/<\s*\/?\s*[a-z!?]/i',
        '/\b(?:javascript|vbscript|livescript)\s*:/i',
        '/\bdata\s*:\s*text\/html/i',
        '/\bon[a-z]{3,}\s*=/i',
        '/&#x?[0-9a-f]+;?/i',
        '/\bexpression\s*\(/i',
    ];

    public function clean(string $value, bool $multiline = false): string
    {
        $value = str_replace(["\r\n", "\r"], "\n", $value);
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
        $value = preg_replace('/[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]/u', '', $value) ?? '';
        if ($multiline) {
            $lines = array_map(
                static fn (string $line): string => trim(preg_replace('/[ \t\x{00A0}]+/u', ' ', $line) ?? ''),
                explode("\n", $value)
            );
            $value = implode("\n", $lines);
            $value = preg_replace('/\n{3,}/', "\n\n", $value) ?? '';
            return trim($value);
        }
        $value = preg_replace('/[\s\x{00A0}]+/u', ' ', $value) ?? '';
        return trim($value);
    }

    public function detectThreat(string $value): ?string
    {
        if (!mb_check_encoding($value, 'UTF-8')) {
            return self::THREAT_ENCODING;
        }
        $decoded = rawurldecode($value);
        foreach ([$value, $decoded] as $candidate) {
            foreach (self::HTML_PATTERNS as $pattern) {
                if (preg_match($pattern, $candidate) === 1) {
                    return self::THREAT_HTML;
                }
            }
            foreach (self::SQL_PATTERNS as $pattern) {
                if (preg_match($pattern, $candidate) === 1) {
                    return self::THREAT_SQL;
                }
            }
        }
        return null;
    }

    public function isSafe(string $value): bool
    {
        return $this->detectThreat($value) === null;
    }

    public static function escape(?string $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
