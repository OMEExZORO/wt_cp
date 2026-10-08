<?php

declare(strict_types=1);

namespace App\Validation;

use App\Exceptions\ValidationException;
use DateTimeImmutable;

final class Validator
{
    public const NAME_PATTERN = '/^[\p{L}\p{M}][\p{L}\p{M} .\'\-]*$/u';
    public const PHONE_PATTERN = '/^(?:\+91)?[6-9]\d{9}$/';
    public const EMAIL_DOMAIN_PATTERN = '/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i';
    public const UUID_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';
    public const TIME_PATTERN = '/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/';
    public const TOKEN_PATTERN = '/^[a-f0-9]{64}$/';
    public const REGISTRATION_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9\/\-. ]{2,29}$/';
    public const PASSWORD_MIN = 10;
    public const PASSWORD_MAX = 128;
    public const DEFAULT_MAX_LENGTH = 255;

    private const TYPE_RULES = ['string', 'text', 'raw', 'name', 'email', 'phone', 'date', 'time', 'uuid', 'integer', 'boolean', 'accepted', 'password', 'token', 'registration_number'];

    private array $errors = [];
    private array $threats = [];

    public function __construct(
        private readonly Sanitizer $sanitizer = new Sanitizer(),
        private readonly bool $checkMx = false
    ) {
    }

    public function validate(array $input, array $rules, array $messages = []): array
    {
        $this->errors = [];
        $this->threats = [];
        $output = [];

        foreach ($rules as $field => $fieldRules) {
            $parsed = $this->parseRules($fieldRules);
            $present = array_key_exists($field, $input);
            $value = $present ? $input[$field] : null;

            if (isset($parsed['sometimes']) && !$present) {
                continue;
            }

            $type = $this->resolveType($parsed);

            if (is_string($value) && !in_array($type, ['raw', 'password', 'boolean', 'accepted'], true)) {
                $value = $this->sanitizer->clean($value, $type === 'text');
            }

            if ($this->isEmpty($value, $type)) {
                if (isset($parsed['required'])) {
                    $this->fail($field, 'required', $messages, $type === 'accepted' ? 'You must accept this to continue.' : 'This field is required.');
                    continue;
                }
                if (isset($parsed['nullable']) || $present) {
                    $output[$field] = null;
                }
                continue;
            }

            if (is_array($value) || is_object($value)) {
                $this->fail($field, 'string', $messages, 'This field has an invalid format.');
                continue;
            }

            $result = $this->applyType($field, $type, $value, $parsed, $messages);
            if ($result === null) {
                continue;
            }
            [$clean] = $result;

            if (!$this->applyConstraints($field, $type, $clean, $parsed, $input, $messages)) {
                continue;
            }

            $output[$field] = $clean;
        }

        if ($this->errors !== []) {
            throw new ValidationException($this->errors, 'Please correct the highlighted fields.', $this->threats);
        }
        return $output;
    }

    public function threats(): array
    {
        return $this->threats;
    }

    private function parseRules(string|array $rules): array
    {
        $list = is_array($rules) ? $rules : explode('|', $rules);
        $parsed = [];
        foreach ($list as $rule) {
            $rule = trim((string) $rule);
            if ($rule === '') {
                continue;
            }
            if (str_starts_with($rule, 'regex:')) {
                $parsed['regex'] = substr($rule, 6);
                continue;
            }
            if (str_contains($rule, ':')) {
                [$name, $arg] = explode(':', $rule, 2);
                $parsed[$name] = $arg;
                continue;
            }
            $parsed[$rule] = true;
        }
        return $parsed;
    }

    private function resolveType(array $parsed): string
    {
        foreach (self::TYPE_RULES as $type) {
            if (isset($parsed[$type])) {
                return $type;
            }
        }
        return 'string';
    }

    private function isEmpty(mixed $value, string $type): bool
    {
        if ($value === null) {
            return true;
        }
        if (is_string($value)) {
            return $type === 'password' || $type === 'raw' ? $value === '' : trim($value) === '';
        }
        if (is_array($value)) {
            return $value === [];
        }
        if ($type === 'accepted') {
            return $value === false;
        }
        return false;
    }

    private function applyType(string $field, string $type, mixed $value, array $parsed, array $messages): ?array
    {
        if (in_array($type, ['integer', 'boolean', 'accepted'], true)) {
            return $this->applyScalarType($field, $type, $value, $messages);
        }

        if (!is_string($value)) {
            if (is_int($value) || is_float($value)) {
                $value = (string) $value;
            } else {
                $this->fail($field, $type, $messages, 'This field has an invalid format.');
                return null;
            }
        }

        if (!in_array($type, ['raw', 'password', 'token'], true)) {
            $threat = $this->sanitizer->detectThreat($value);
            if ($threat !== null) {
                $this->threats[] = ['field' => $field, 'type' => $threat, 'sample' => mb_substr($value, 0, 200)];
                $this->fail($field, 'safe', $messages, 'This field contains characters or patterns that are not allowed.');
                return null;
            }
        } elseif (!mb_check_encoding($value, 'UTF-8')) {
            $this->fail($field, $type, $messages, 'This field has an invalid format.');
            return null;
        }

        switch ($type) {
            case 'name':
                if (preg_match(self::NAME_PATTERN, $value) !== 1) {
                    $this->fail($field, 'name', $messages, 'Use letters, spaces, apostrophes, dots and hyphens only.');
                    return null;
                }
                return [$value];
            case 'email':
                $email = mb_strtolower($value);
                if (!$this->isValidEmail($email)) {
                    $this->fail($field, 'email', $messages, 'Enter a valid email address.');
                    return null;
                }
                return [$email];
            case 'phone':
                $phone = preg_replace('/[\s\-()]/', '', $value) ?? '';
                if (preg_match(self::PHONE_PATTERN, $phone) !== 1) {
                    $this->fail($field, 'phone', $messages, 'Enter a valid 10 digit Indian mobile number.');
                    return null;
                }
                return [substr($phone, -10)];
            case 'date':
                $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
                if ($date === false || $date->format('Y-m-d') !== $value) {
                    $this->fail($field, 'date', $messages, 'Enter a valid date (YYYY-MM-DD).');
                    return null;
                }
                return [$value];
            case 'time':
                if (preg_match(self::TIME_PATTERN, $value) !== 1) {
                    $this->fail($field, 'time', $messages, 'Enter a valid time (HH:MM).');
                    return null;
                }
                return [substr($value, 0, 5)];
            case 'uuid':
                if (preg_match(self::UUID_PATTERN, $value) !== 1) {
                    $this->fail($field, 'uuid', $messages, 'This identifier is not valid.');
                    return null;
                }
                return [strtolower($value)];
            case 'token':
                if (preg_match(self::TOKEN_PATTERN, $value) !== 1) {
                    $this->fail($field, 'token', $messages, 'This link is invalid or has expired.');
                    return null;
                }
                return [$value];
            case 'registration_number':
                if (preg_match(self::REGISTRATION_PATTERN, $value) !== 1) {
                    $this->fail($field, 'registration_number', $messages, 'Use 3 to 30 letters, digits, spaces, dots, slashes or hyphens.');
                    return null;
                }
                return [$value];
            case 'password':
                $problem = self::passwordProblem($value);
                if ($problem !== null) {
                    $this->fail($field, 'password', $messages, $problem);
                    return null;
                }
                return [$value];
            default:
                return [$value];
        }
    }

    private function applyScalarType(string $field, string $type, mixed $value, array $messages): ?array
    {
        if ($type === 'integer') {
            $int = filter_var($value, FILTER_VALIDATE_INT);
            if ($int === false || is_bool($value)) {
                $this->fail($field, 'integer', $messages, 'Enter a whole number.');
                return null;
            }
            return [$int];
        }
        $bool = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($bool === null || is_array($value)) {
            $this->fail($field, $type, $messages, 'This field must be true or false.');
            return null;
        }
        if ($type === 'accepted' && $bool !== true) {
            $this->fail($field, 'accepted', $messages, 'You must accept this to continue.');
            return null;
        }
        return [$bool];
    }

    private function applyConstraints(string $field, string $type, mixed $value, array $parsed, array $input, array $messages): bool
    {
        $isNumeric = $type === 'integer';
        $measure = $isNumeric ? $value : (is_string($value) ? mb_strlen($value) : null);

        if ($measure !== null) {
            $max = isset($parsed['max']) ? (int) $parsed['max'] : ($isNumeric || $type === 'password' ? null : self::DEFAULT_MAX_LENGTH);
            if (isset($parsed['min']) && $measure < (int) $parsed['min']) {
                $this->fail($field, 'min', $messages, $isNumeric
                    ? sprintf('Must be at least %d.', (int) $parsed['min'])
                    : sprintf('Must be at least %d characters.', (int) $parsed['min']));
                return false;
            }
            if ($max !== null && $measure > $max) {
                $this->fail($field, 'max', $messages, $isNumeric
                    ? sprintf('Must be at most %d.', $max)
                    : sprintf('Must be at most %d characters.', $max));
                return false;
            }
        }

        if (isset($parsed['in'])) {
            $allowed = explode(',', (string) $parsed['in']);
            if (!in_array((string) $value, $allowed, true)) {
                $this->fail($field, 'in', $messages, 'Choose one of the allowed options.');
                return false;
            }
        }

        if (isset($parsed['regex']) && is_string($value) && preg_match((string) $parsed['regex'], $value) !== 1) {
            $this->fail($field, 'regex', $messages, 'This field has an invalid format.');
            return false;
        }

        if ($type === 'date') {
            foreach (['before', 'after', 'before_or_equal', 'after_or_equal'] as $rule) {
                if (!isset($parsed[$rule])) {
                    continue;
                }
                $bound = $parsed[$rule] === 'today' ? date('Y-m-d') : (string) $parsed[$rule];
                $ok = match ($rule) {
                    'before' => $value < $bound,
                    'after' => $value > $bound,
                    'before_or_equal' => $value <= $bound,
                    'after_or_equal' => $value >= $bound,
                };
                if (!$ok) {
                    $label = str_replace('_', ' ', $rule);
                    $this->fail($field, $rule, $messages, sprintf('The date must be %s %s.', $label, $parsed[$rule] === 'today' ? 'today' : $bound));
                    return false;
                }
            }
        }

        if (isset($parsed['confirmed'])) {
            $confirmation = $input[$field . '_confirmation'] ?? null;
            if (!is_string($confirmation) || !hash_equals((string) $value, $confirmation)) {
                $this->errors[$field . '_confirmation'] = $messages[$field . '.confirmed'] ?? 'The values do not match.';
                return false;
            }
        }

        if (isset($parsed['different']) && is_string($value)) {
            $other = $input[(string) $parsed['different']] ?? null;
            if (is_string($other) && hash_equals($other, $value)) {
                $this->fail($field, 'different', $messages, 'Choose a value different from the current one.');
                return false;
            }
        }

        return true;
    }

    private function isValidEmail(string $email): bool
    {
        if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return false;
        }
        $domain = substr((string) strrchr($email, '@'), 1);
        if (preg_match(self::EMAIL_DOMAIN_PATTERN, $domain) !== 1) {
            return false;
        }
        if ($this->checkMx) {
            return checkdnsrr($domain, 'MX') || checkdnsrr($domain, 'A');
        }
        return true;
    }

    public static function passwordProblem(string $password): ?string
    {
        $length = mb_strlen($password);
        if ($length < self::PASSWORD_MIN) {
            return sprintf('Use at least %d characters.', self::PASSWORD_MIN);
        }
        if ($length > self::PASSWORD_MAX) {
            return sprintf('Use at most %d characters.', self::PASSWORD_MAX);
        }
        if (preg_match('/\p{Ll}/u', $password) !== 1
            || preg_match('/\p{Lu}/u', $password) !== 1
            || preg_match('/\d/', $password) !== 1
            || preg_match('/[^\p{L}\d]/u', $password) !== 1) {
            return 'Include upper and lower case letters, a number and a symbol.';
        }
        return null;
    }

    private function fail(string $field, string $rule, array $messages, string $default): void
    {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = $messages[$field . '.' . $rule] ?? $messages[$field] ?? $default;
        }
    }
}
