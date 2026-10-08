<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Exceptions\ValidationException;
use App\Validation\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ValidatorTest extends TestCase
{
    private Validator $validator;

    protected function setUp(): void
    {
        $this->validator = new Validator();
    }

    private function errors(array $input, array $rules): array
    {
        try {
            $this->validator->validate($input, $rules);
        } catch (ValidationException $e) {
            return $e->fields();
        }
        return [];
    }

    public function testReturnsOnlyFieldsDeclaredInRules(): void
    {
        $data = $this->validator->validate(['full_name' => 'Asha', 'role' => 'admin'], ['full_name' => 'required|name']);
        self::assertSame(['full_name' => 'Asha'], $data);
    }

    public function testRequiredRejectsMissingAndBlank(): void
    {
        $errors = $this->errors(['a' => '   '], ['a' => 'required|string', 'b' => 'required|string']);
        self::assertArrayHasKey('a', $errors);
        self::assertArrayHasKey('b', $errors);
    }

    public function testTrimsAndNormalisesWhitespace(): void
    {
        $data = $this->validator->validate(['full_name' => "  Asha   Patil "], ['full_name' => 'required|name']);
        self::assertSame('Asha Patil', $data['full_name']);
    }

    public static function names(): array
    {
        return [
            ['Asha Patil', true],
            ["D'Souza", true],
            ['Dr. R. K. Jain-Shah', true],
            ['मेघनाद', true],
            ['Asha123', false],
            ['Asha_Patil', false],
            ['-Asha', false],
        ];
    }

    #[DataProvider('names')]
    public function testNameRule(string $name, bool $valid): void
    {
        self::assertSame($valid, $this->errors(['n' => $name], ['n' => 'required|name']) === []);
    }

    public static function phones(): array
    {
        return [
            ['9876543210', '9876543210'],
            ['+919876543210', '9876543210'],
            ['+91 98765 43210', '9876543210'],
            ['98765-43210', '9876543210'],
            ['5876543210', null],
            ['987654321', null],
            ['09876543210', null],
            ['+449876543210', null],
        ];
    }

    #[DataProvider('phones')]
    public function testIndianMobileRuleNormalises(string $input, ?string $expected): void
    {
        if ($expected === null) {
            self::assertArrayHasKey('phone', $this->errors(['phone' => $input], ['phone' => 'required|phone']));
            return;
        }
        self::assertSame($expected, $this->validator->validate(['phone' => $input], ['phone' => 'required|phone'])['phone']);
    }

    public static function emails(): array
    {
        return [
            ['Patient@Example.com', true],
            ['a.b+tag@mail.example.co.in', true],
            ['user@localhost', false],
            ['user@-bad.com', false],
            ['user@example.c', false],
            ['not-an-email', false],
            ['user@exa mple.com', false],
        ];
    }

    #[DataProvider('emails')]
    public function testEmailRule(string $email, bool $valid): void
    {
        self::assertSame($valid, $this->errors(['email' => $email], ['email' => 'required|email']) === []);
    }

    public function testEmailIsLowercased(): void
    {
        self::assertSame('patient@example.com', $this->validator->validate(['email' => 'Patient@Example.COM'], ['email' => 'required|email'])['email']);
    }

    public function testDateRuleAndBounds(): void
    {
        self::assertSame([], $this->errors(['d' => '1990-02-28'], ['d' => 'required|date|before:today']));
        self::assertArrayHasKey('d', $this->errors(['d' => '1990-02-30'], ['d' => 'required|date']));
        self::assertArrayHasKey('d', $this->errors(['d' => '28/02/1990'], ['d' => 'required|date']));
        self::assertArrayHasKey('d', $this->errors(['d' => '2999-01-01'], ['d' => 'required|date|before:today']));
    }

    public function testTimeRule(): void
    {
        self::assertSame('09:30', $this->validator->validate(['t' => '09:30:00'], ['t' => 'required|time'])['t']);
        self::assertArrayHasKey('t', $this->errors(['t' => '24:00'], ['t' => 'required|time']));
    }

    public function testUuidRule(): void
    {
        self::assertSame([], $this->errors(['id' => 'c4cccc6d-1c59-45ba-b4ef-730f48ff8760'], ['id' => 'required|uuid']));
        self::assertArrayHasKey('id', $this->errors(['id' => '1 OR 1=1'], ['id' => 'required|uuid']));
        self::assertArrayHasKey('id', $this->errors(['id' => '12345'], ['id' => 'required|uuid']));
    }

    public function testEnumRule(): void
    {
        self::assertSame([], $this->errors(['u' => 'Urgent'], ['u' => 'required|in:Routine,Priority,Urgent']));
        self::assertArrayHasKey('u', $this->errors(['u' => 'urgent'], ['u' => 'required|in:Routine,Priority,Urgent']));
    }

    public function testIntegerRangeRule(): void
    {
        self::assertSame(4, $this->validator->validate(['r' => '4'], ['r' => 'required|integer|min:1|max:5'])['r']);
        self::assertArrayHasKey('r', $this->errors(['r' => 6], ['r' => 'required|integer|min:1|max:5']));
        self::assertArrayHasKey('r', $this->errors(['r' => '4.5'], ['r' => 'required|integer']));
    }

    public function testBooleanAndAccepted(): void
    {
        self::assertFalse($this->validator->validate(['b' => 'false'], ['b' => 'required|boolean'])['b']);
        self::assertTrue($this->validator->validate(['c' => true], ['c' => 'required|accepted'])['c']);
        self::assertArrayHasKey('c', $this->errors(['c' => false], ['c' => 'required|accepted']));
        self::assertArrayHasKey('c', $this->errors([], ['c' => 'required|accepted']));
    }

    public static function passwords(): array
    {
        return [
            ['Strong@Pass2026', true],
            ['short1!A', false],
            ['alllowercase1!', false],
            ['NoDigitsHere!!', false],
            ['NoSymbols12345', false],
        ];
    }

    #[DataProvider('passwords')]
    public function testPasswordStrength(string $password, bool $valid): void
    {
        self::assertSame($valid, $this->errors(['p' => $password], ['p' => 'required|password']) === []);
    }

    public function testPasswordIsNotTrimmedOrScanned(): void
    {
        $data = $this->validator->validate(['p' => " Strong@Pass' OR 1 "], ['p' => 'required|password']);
        self::assertSame(" Strong@Pass' OR 1 ", $data['p']);
    }

    public function testConfirmedRule(): void
    {
        $errors = $this->errors(['p' => 'Strong@Pass2026', 'p_confirmation' => 'Other@Pass2026'], ['p' => 'required|password|confirmed']);
        self::assertArrayHasKey('p_confirmation', $errors);
    }

    public function testMaxLengthAndDefaultCap(): void
    {
        self::assertArrayHasKey('s', $this->errors(['s' => str_repeat('a', 11)], ['s' => 'required|string|max:10']));
        self::assertArrayHasKey('s', $this->errors(['s' => str_repeat('a', 256)], ['s' => 'required|string']));
        self::assertArrayHasKey('s', $this->errors(['s' => 'ab'], ['s' => 'required|string|min:3']));
    }

    public function testOversizedInputIsRejected(): void
    {
        $errors = $this->errors(['full_name' => str_repeat('A', 10000)], ['full_name' => 'required|name|max:120']);
        self::assertArrayHasKey('full_name', $errors);
    }

    public function testNullableAndSometimes(): void
    {
        $data = $this->validator->validate(['city' => ''], ['city' => 'nullable|string', 'dob' => 'nullable|date', 'phone' => 'sometimes|required|phone']);
        self::assertSame(['city' => null, 'dob' => null], $data);
    }

    public function testArrayValuesAreRejectedForStringFields(): void
    {
        self::assertArrayHasKey('n', $this->errors(['n' => ['x']], ['n' => 'required|string']));
    }

    public static function attackPayloads(): array
    {
        return [
            ["' OR '1'='1", 'sqli'],
            ["'; DROP TABLE users;--", 'sqli'],
            ['<script>alert(1)</script>', 'xss'],
        ];
    }

    #[DataProvider('attackPayloads')]
    public function testAttackPayloadsAreRejectedAndReported(string $payload, string $type): void
    {
        try {
            $this->validator->validate(['city' => $payload], ['city' => 'required|string|max:80']);
            self::fail('Payload was accepted');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('city', $e->fields());
            self::assertSame($type, $e->threats()[0]['type']);
            self::assertSame('city', $e->threats()[0]['field']);
        }
    }

    public function testRegexRuleInArrayForm(): void
    {
        $rules = ['code' => ['required', 'regex:/^[A-Z]{3}$/']];
        self::assertSame([], $this->errors(['code' => 'USG'], $rules));
        self::assertArrayHasKey('code', $this->errors(['code' => 'usg1'], $rules));
    }

    public function testCustomMessagesOverrideDefaults(): void
    {
        try {
            $this->validator->validate([], ['consent' => 'required|accepted'], ['consent.required' => 'Consent needed']);
            self::fail('Expected failure');
        } catch (ValidationException $e) {
            self::assertSame('Consent needed', $e->fields()['consent']);
            self::assertSame('VALIDATION_FAILED', $e->errorCode());
            self::assertSame(422, $e->status());
        }
    }
}
