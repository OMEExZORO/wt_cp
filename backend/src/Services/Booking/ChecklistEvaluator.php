<?php

declare(strict_types=1);

namespace App\Services\Booking;

use App\Models\Model;

final class ChecklistEvaluator
{
    public const ANSWER_MAX = 500;

    public static function rules(array $items): array
    {
        $rules = [];
        foreach ($items as $item) {
            $presence = Model::flag($item['is_required']) ? 'required' : 'nullable';
            $rules[(string) $item['id']] = match ((string) $item['answer_type']) {
                'yes_no' => $presence . '|in:yes,no',
                'yes_no_unsure' => $presence . '|in:yes,no,unsure',
                'date' => $presence . '|date|after:1900-01-01|before_or_equal:today',
                default => $presence . '|text|max:' . self::ANSWER_MAX,
            };
        }
        return $rules;
    }

    public static function attentionAnswers(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_map('strval', $value));
        }
        $text = trim((string) $value);
        if ($text === '' || $text === '{}') {
            return [];
        }
        $inner = substr($text, 1, -1);
        if ($inner === false || $inner === '') {
            return [];
        }
        $values = str_getcsv($inner, ',', '"', '\\');
        return array_values(array_filter(array_map(static fn (?string $v): string => trim((string) $v), $values), static fn (string $v): bool => $v !== ''));
    }

    public static function evaluate(array $items, array $answers): array
    {
        $result = [];
        foreach ($items as $item) {
            $id = (string) $item['id'];
            $answer = $answers[$id] ?? null;
            if ($answer === null || $answer === '') {
                continue;
            }
            $answer = (string) $answer;
            $result[] = [
                'checklist_item_id' => $id,
                'code' => (string) $item['code'],
                'question' => (string) $item['question'],
                'answer' => $answer,
                'needs_attention' => in_array(strtolower($answer), array_map('strtolower', self::attentionAnswers($item['attention_answers'] ?? [])), true),
            ];
        }
        return $result;
    }

    public static function prefixErrors(array $fields, string $prefix = 'answers'): array
    {
        $prefixed = [];
        foreach ($fields as $key => $message) {
            $prefixed[$prefix . '.' . $key] = $message;
        }
        return $prefixed;
    }
}
