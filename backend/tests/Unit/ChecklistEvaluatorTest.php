<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Exceptions\ValidationException;
use App\Services\Booking\ChecklistEvaluator;
use App\Validation\Validator;
use PHPUnit\Framework\TestCase;

final class ChecklistEvaluatorTest extends TestCase
{
    private const ALLERGY = '11111111-1111-4111-8111-111111111111';
    private const COMPANION = '22222222-2222-4222-8222-222222222222';
    private const LMP = '33333333-3333-4333-8333-333333333333';
    private const NOTES = '44444444-4444-4444-8444-444444444444';

    private function items(): array
    {
        return [
            ['id' => self::ALLERGY, 'code' => 'ct_contrast_allergy', 'question' => 'Contrast allergy?', 'answer_type' => 'yes_no_unsure', 'is_required' => true, 'attention_answers' => '{yes,unsure}'],
            ['id' => self::COMPANION, 'code' => 'biopsy_companion', 'question' => 'Companion?', 'answer_type' => 'yes_no', 'is_required' => 't', 'attention_answers' => '{no}'],
            ['id' => self::LMP, 'code' => 'pelvic_lmp_date', 'question' => 'LMP', 'answer_type' => 'date', 'is_required' => false, 'attention_answers' => '{}'],
            ['id' => self::NOTES, 'code' => 'free_text', 'question' => 'Anything else?', 'answer_type' => 'text', 'is_required' => false, 'attention_answers' => []],
        ];
    }

    public function testBuildsRulesPerAnswerType(): void
    {
        $rules = ChecklistEvaluator::rules($this->items());
        self::assertSame('required|in:yes,no,unsure', $rules[self::ALLERGY]);
        self::assertSame('required|in:yes,no', $rules[self::COMPANION]);
        self::assertStringStartsWith('nullable|date', $rules[self::LMP]);
        self::assertSame('nullable|text|max:500', $rules[self::NOTES]);
    }

    public function testParsesPostgresArrays(): void
    {
        self::assertSame(['yes', 'unsure'], ChecklistEvaluator::attentionAnswers('{yes,unsure}'));
        self::assertSame([], ChecklistEvaluator::attentionAnswers('{}'));
        self::assertSame(['no'], ChecklistEvaluator::attentionAnswers(['no']));
        self::assertSame(['a b'], ChecklistEvaluator::attentionAnswers('{"a b"}'));
    }

    public function testFlagsAttentionAnswersForStaff(): void
    {
        $result = ChecklistEvaluator::evaluate($this->items(), [self::ALLERGY => 'unsure', self::COMPANION => 'yes', self::LMP => null]);
        self::assertCount(2, $result);
        self::assertSame('ct_contrast_allergy', $result[0]['code']);
        self::assertTrue($result[0]['needs_attention']);
        self::assertFalse($result[1]['needs_attention']);

        $result = ChecklistEvaluator::evaluate($this->items(), [self::ALLERGY => 'no', self::COMPANION => 'no']);
        self::assertFalse($result[0]['needs_attention']);
        self::assertTrue($result[1]['needs_attention']);
    }

    public function testRejectsMissingRequiredAnswersAndUnknownOptions(): void
    {
        try {
            (new Validator())->validate([self::ALLERGY => 'maybe', self::LMP => '2999-01-01'], ChecklistEvaluator::rules($this->items()));
            self::fail('Expected validation to fail');
        } catch (ValidationException $e) {
            $fields = ChecklistEvaluator::prefixErrors($e->fields());
            self::assertArrayHasKey('answers.' . self::ALLERGY, $fields);
            self::assertArrayHasKey('answers.' . self::COMPANION, $fields);
            self::assertArrayHasKey('answers.' . self::LMP, $fields);
        }
    }

    public function testRejectsScriptPayloadInFreeText(): void
    {
        try {
            (new Validator())->validate(
                [self::ALLERGY => 'no', self::COMPANION => 'yes', self::NOTES => '<script>alert(1)</script>'],
                ChecklistEvaluator::rules($this->items())
            );
            self::fail('Expected validation to fail');
        } catch (ValidationException $e) {
            self::assertArrayHasKey(self::NOTES, $e->fields());
            self::assertSame('xss', $e->threats()[0]['type']);
        }
    }
}
