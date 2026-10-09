<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Controllers\Admin\SettingsAdminController;
use App\Core\Request;
use App\Exceptions\ValidationException;
use App\Models\AdminRepository;
use App\Services\Admin\SettingsValidator;
use App\Validation\RequestValidator;
use App\Validation\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakePdo;
use Tests\Support\InMemoryAuditLogger;

final class SettingsValidationTest extends TestCase
{
    private static function row(string $key, string $type, string $group = 'contact'): array
    {
        return ['key' => $key, 'value' => null, 'value_type' => $type, 'group_name' => $group, 'label' => $key, 'is_public' => true, 'is_placeholder' => true, 'updated_at' => null];
    }

    private function validate(array $rows, array $input): array
    {
        $byKey = [];
        foreach ($rows as $row) {
            $byKey[$row['key']] = $row;
        }
        return (new Validator())->validate($input, SettingsValidator::buildRules($byKey));
    }

    public static function validPhones(): array
    {
        return [['9876543210', '9876543210'], ['+91 98765-43210', '9876543210'], ['6000000000', '6000000000']];
    }

    #[DataProvider('validPhones')]
    public function testPhoneAcceptsIndianMobileNumbers(string $input, string $expected): void
    {
        $clean = $this->validate([self::row('contact.phone', 'phone')], ['contact.phone' => $input]);
        self::assertSame($expected, $clean['contact.phone']);
    }

    public static function invalidPhones(): array
    {
        return [['12345'], ['5876543210'], ['98765432101'], ['abcdefghij'], ["9876543210'; DROP TABLE users;--"]];
    }

    #[DataProvider('invalidPhones')]
    public function testPhoneRejectsAnythingElse(string $input): void
    {
        $this->expectException(ValidationException::class);
        $this->validate([self::row('contact.phone', 'phone')], ['contact.phone' => $input]);
    }

    public static function validUrls(): array
    {
        return [['https://g.page/r/abc123/review'], ['https://www.google.com/maps/place/Pune?cid=123&hl=en'], ['https://maps.app.goo.gl/AbCdEf']];
    }

    #[DataProvider('validUrls')]
    public function testUrlAcceptsHttps(string $url): void
    {
        $clean = $this->validate([self::row('links.google_reviews_url', 'url', 'links')], ['links.google_reviews_url' => $url]);
        self::assertSame($url, $clean['links.google_reviews_url']);
    }

    public static function invalidUrls(): array
    {
        return [
            'plain http' => ['http://g.page/x'],
            'javascript scheme' => ['javascript:alert(1)'],
            'data scheme' => ['data:text/html,<b>x</b>'],
            'ftp' => ['ftp://example.com/file'],
            'no scheme' => ['www.google.com/maps'],
            'credentials' => ['https://user:pass@example.com/'],
            'spaces' => ['https://example.com/a b'],
            'angle brackets' => ['https://example.com/<x>'],
            'oversized' => ['https://example.com/' . str_repeat('a', 600)],
        ];
    }

    #[DataProvider('invalidUrls')]
    public function testUrlRejectsAnythingButHttps(string $url): void
    {
        $this->expectException(ValidationException::class);
        $this->validate([self::row('links.google_reviews_url', 'url', 'links')], ['links.google_reviews_url' => $url]);
    }

    public function testEmailIsValidated(): void
    {
        $clean = $this->validate([self::row('contact.email', 'email')], ['contact.email' => 'Hello@Example.com']);
        self::assertSame('hello@example.com', $clean['contact.email']);
        $this->expectException(ValidationException::class);
        $this->validate([self::row('contact.email', 'email')], ['contact.email' => 'not-an-email']);
    }

    public function testOptionalSettingsCanBeClearedBackToPlaceholder(): void
    {
        $clean = $this->validate([self::row('contact.phone', 'phone')], ['contact.phone' => '   ']);
        self::assertNull($clean['contact.phone']);
    }

    public function testRequiredSettingsCannotBeCleared(): void
    {
        $this->expectException(ValidationException::class);
        $this->validate([self::row('doctor.name', 'string', 'doctor')], ['doctor.name' => '']);
    }

    public function testEscalationWindowMustBeAReasonableNumber(): void
    {
        $row = self::row('alerts.escalation_minutes', 'string', 'alerts');
        self::assertSame(45, $this->validate([$row], ['alerts.escalation_minutes' => 45])['alerts.escalation_minutes']);
        $this->expectException(ValidationException::class);
        $this->validate([$row], ['alerts.escalation_minutes' => 0]);
    }

    public function testScriptPayloadInTextIsRejected(): void
    {
        $this->expectException(ValidationException::class);
        $this->validate([self::row('contact.opening_hours', 'text')], ['contact.opening_hours' => '<script>alert(1)</script>']);
    }

    public function testLegalJsonAndImageSettingsAreReadOnly(): void
    {
        self::assertFalse(SettingsValidator::isEditable(self::row('legal.pcpndt_notice', 'string', 'legal')));
        self::assertFalse(SettingsValidator::isEditable(self::row('clinic.taglines', 'json', 'clinic')));
        self::assertFalse(SettingsValidator::isEditable(self::row('doctor.photo_url', 'image', 'doctor')));
        self::assertTrue(SettingsValidator::isEditable(self::row('contact.phone', 'phone')));
    }

    private function controller(FakePdo $pdo, InMemoryAuditLogger $audit): SettingsAdminController
    {
        $controller = new SettingsAdminController($audit, new AdminRepository($pdo));
        $controller->setRequestValidator(new RequestValidator($audit));
        return $controller;
    }

    private function request(array $body): Request
    {
        $request = new Request('PATCH', '/api/v1/admin/settings', [], ['content-type' => 'application/json'], (string) json_encode($body));
        $request->setUser(['id' => '00000000-0000-4000-8000-000000000001', 'role' => 'admin']);
        return $request;
    }

    public function testControllerRejectsBadValuesAndWritesNothing(): void
    {
        $pdo = new FakePdo();
        $pdo->on('FROM site_settings WHERE key IN', [self::row('contact.phone', 'phone')]);
        $audit = new InMemoryAuditLogger();
        try {
            $this->controller($pdo, $audit)->update($this->request(['settings' => ['contact.phone' => '12345']]));
            self::fail('Expected a validation error');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('contact.phone', $e->fields());
        }
        self::assertSame([], array_filter($pdo->writes(), static fn (string $sql): bool => str_contains($sql, 'UPDATE site_settings')));
        self::assertNotContains('admin.settings_updated', $audit->actions());
    }

    public function testControllerRejectsUnknownKeysAndMalformedBodies(): void
    {
        $pdo = new FakePdo();
        $controller = $this->controller($pdo, new InMemoryAuditLogger());
        foreach ([['settings' => ['made.up' => 'x']], ['settings' => ['a']], ['settings' => []], []] as $body) {
            try {
                $controller->update($this->request($body));
                self::fail('Expected a validation error');
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }
        self::assertSame([], array_filter($pdo->writes(), static fn (string $sql): bool => str_contains($sql, 'UPDATE site_settings')));
    }

    public function testControllerSavesAValidValueAndAuditsIt(): void
    {
        $pdo = new FakePdo();
        $pdo->on('FROM site_settings WHERE key IN', [self::row('contact.phone', 'phone')]);
        $pdo->on('FROM site_settings ORDER BY', []);
        $audit = new InMemoryAuditLogger();
        $this->controller($pdo, $audit)->update($this->request(['settings' => ['contact.phone' => '9876543210']]));
        self::assertCount(1, array_filter($pdo->writes(), static fn (string $sql): bool => str_contains($sql, 'UPDATE site_settings')));
        self::assertContains('admin.settings_updated', $audit->actions());
    }
}
