<?php

declare(strict_types=1);

namespace DiagnoCare\Core;

use DateTimeImmutable;

final class Validator
{
    private array $errors = [];
    private array $clean = [];

    private function __construct(private readonly array $data, private readonly array $rules)
    {
    }

    public static function validate(array $data, array $rules): array
    {
        $validator = new self($data, $rules);
        $validator->run();
        if ($validator->errors !== []) {
            throw new HttpException(422, 'Please correct the highlighted fields.', $validator->errors);
        }
        return $validator->clean;
    }

    private function run(): void
    {
        foreach ($this->rules as $field => $ruleString) {
            $rules = is_array($ruleString) ? $ruleString : explode('|', $ruleString);
            $value = $this->data[$field] ?? null;
            $nullable = in_array('nullable', $rules, true);
            $required = in_array('required', $rules, true);

            if (is_string($value)) {
                $value = trim($value);
            }

            if ($value === null || $value === '') {
                if ($required) {
                    $this->errors[$field] = 'This field is required.';
                } elseif ($nullable || array_key_exists($field, $this->data)) {
                    $this->clean[$field] = null;
                }
                continue;
            }

            if (is_array($value) && !in_array('array', $rules, true)) {
                $this->errors[$field] = 'Invalid value.';
                continue;
            }

            foreach ($rules as $rule) {
                [$name, $arg] = array_pad(explode(':', $rule, 2), 2, null);
                $result = $this->apply($name, $arg, $value);
                if (is_string($result)) {
                    $this->errors[$field] = $result;
                    continue 2;
                }
                $value = $result[0];
            }
            $this->clean[$field] = $value;
        }
    }

    private function apply(string $rule, ?string $arg, mixed $value): array|string
    {
        switch ($rule) {
            case 'required':
            case 'nullable':
            case 'array':
                return [$value];
            case 'string':
                if (!is_string($value) && !is_int($value)) {
                    return 'Must be text.';
                }
                $value = (string) $value;
                if (!mb_check_encoding($value, 'UTF-8') || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
                    return 'Contains invalid characters.';
                }
                return [$value];
            case 'min':
                return mb_strlen((string) $value) >= (int) $arg ? [$value] : "Must be at least {$arg} characters.";
            case 'max':
                return mb_strlen((string) $value) <= (int) $arg ? [$value] : "Must be at most {$arg} characters.";
            case 'email':
                $value = strtolower((string) $value);
                return filter_var($value, FILTER_VALIDATE_EMAIL) !== false && strlen($value) <= 190 ? [$value] : 'Enter a valid email address.';
            case 'phone':
                $digits = preg_replace('/[\s-]/', '', (string) $value);
                $digits = preg_replace('/^(\+91|0)/', '', $digits);
                return preg_match('/^[6-9][0-9]{9}$/', $digits) ? [$digits] : 'Enter a valid 10-digit Indian mobile number.';
            case 'landline_or_phone':
                $digits = preg_replace('/[\s-]/', '', (string) $value);
                return preg_match('/^\+?[0-9]{8,13}$/', $digits) ? [$digits] : 'Enter a valid phone number.';
            case 'pincode':
                return preg_match('/^[1-9][0-9]{5}$/', (string) $value) ? [(string) $value] : 'Enter a valid 6-digit pincode.';
            case 'name':
                return preg_match("/^[\p{L}][\p{L} .'-]*$/u", (string) $value) ? [$value] : 'Use letters, spaces, dots, hyphens or apostrophes only.';
            case 'int':
                if (is_int($value)) {
                    return [$value];
                }
                return is_string($value) && preg_match('/^-?[0-9]{1,10}$/', $value) ? [(int) $value] : 'Must be a whole number.';
            case 'id':
                $int = $this->apply('int', null, $value);
                return is_array($int) && $int[0] > 0 ? $int : 'Invalid selection.';
            case 'between':
                [$lo, $hi] = array_map('floatval', explode(',', (string) $arg));
                return $value >= $lo && $value <= $hi ? [$value] : "Must be between {$lo} and {$hi}.";
            case 'decimal':
                return is_numeric($value) && preg_match('/^[0-9]{1,8}(\.[0-9]{1,2})?$/', (string) $value) ? [round((float) $value, 2)] : 'Enter a valid amount.';
            case 'bool':
                $bool = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                return $bool === null ? 'Must be true or false.' : [$bool];
            case 'in':
                $allowed = explode(',', (string) $arg);
                return in_array((string) $value, $allowed, true) ? [(string) $value] : 'Invalid option selected.';
            case 'date':
                $date = DateTimeImmutable::createFromFormat('!Y-m-d', (string) $value);
                return $date && $date->format('Y-m-d') === $value ? [$value] : 'Enter a valid date (YYYY-MM-DD).';
            case 'past_date':
                return $value < date('Y-m-d') ? [$value] : 'Date must be in the past.';
            case 'not_past':
                return $value >= date('Y-m-d') ? [$value] : 'Date cannot be in the past.';
            case 'time':
                if (preg_match('/^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$/', (string) $value)) {
                    return [substr((string) $value, 0, 5) . ':00'];
                }
                return 'Enter a valid time (HH:MM).';
            case 'password':
                $ok = strlen((string) $value) >= 8 && strlen((string) $value) <= 72
                    && preg_match('/[A-Za-z]/', (string) $value) && preg_match('/[0-9]/', (string) $value);
                return $ok ? [$value] : 'Password must be 8-72 characters and include a letter and a number.';
            case 'regex':
                return preg_match((string) $arg, (string) $value) ? [$value] : 'Invalid format.';
            default:
                throw new \LogicException('Unknown validation rule: ' . $rule);
        }
    }
}
