<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Controllers\AppointmentController;
use App\Core\Config;
use App\Core\Logger;
use App\Core\Request;
use App\Exceptions\NotFoundException;
use App\Exceptions\ValidationException;
use App\Models\Appointment;
use App\Models\AppointmentChecklistAnswer;
use App\Models\ChecklistItem;
use App\Models\Patient;
use App\Models\ScanType;
use App\Models\Slot;
use App\Services\Booking\AppointmentNotifier;
use App\Services\Booking\BookingService;
use App\Services\Clock;
use App\Services\Mail\LogMailer;
use App\Services\Mail\MailService;
use App\Validation\RequestValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakePdo;
use Tests\Support\InMemoryAuditLogger;

final class AppointmentControllerTest extends TestCase
{
    private const SCAN = '0b6f4a52-6c1e-4d55-9a44-9d3f3c2b1a10';
    private const SLOT = '5d0a8f3e-1b2c-4d3e-8f4a-5b6c7d8e9f00';
    private const ALLERGY = '11111111-1111-4111-8111-111111111111';
    private const PATIENT_USER = '00000000-0000-4000-8000-000000000004';
    private const OTHER_USER = '00000000-0000-4000-8000-000000000099';
    private const APPOINTMENT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

    private FakePdo $pdo;
    private InMemoryAuditLogger $audit;
    private AppointmentController $controller;
    private string $tmp;

    protected function setUp(): void
    {
        $this->tmp = sys_get_temp_dir() . '/dc-test-' . bin2hex(random_bytes(4));
        $this->pdo = new FakePdo();
        $this->pdo->on('FROM scan_types t JOIN scan_categories', [[
            'id' => self::SCAN, 'slug' => 'ct-brain', 'modality' => 'CT', 'name' => 'CT Brain',
            'preparation_tips' => 'Remove metal items.', 'duration_minutes' => 20, 'is_bookable_online' => true,
        ]]);
        $this->pdo->on('FROM checklist_items', [[
            'id' => self::ALLERGY, 'scan_type_id' => null, 'modality' => 'CT', 'code' => 'ct_contrast_allergy',
            'question' => 'Contrast allergy?', 'help_text' => null, 'answer_type' => 'yes_no_unsure',
            'is_required' => true, 'attention_answers' => '{yes,unsure}', 'sort_order' => 1,
        ]]);
        $this->audit = new InMemoryAuditLogger();
        $config = new Config(['url' => 'http://localhost:8000', 'frontend_url' => 'http://localhost:5173', 'auth' => ['consent_version' => 'test']]);
        $clock = new Clock('2026-10-08 10:00');
        $mail = new MailService(new LogMailer($this->tmp . '/mail.log', 'test@example.com'), new Logger($this->tmp . '/app.log'), dirname(__DIR__, 2) . '/templates/emails');
        $this->controller = new AppointmentController(
            $config,
            new Appointment($this->pdo),
            new AppointmentChecklistAnswer($this->pdo),
            new ChecklistItem($this->pdo),
            new ScanType($this->pdo),
            new Patient($this->pdo),
            new BookingService(new Slot($this->pdo), new Appointment($this->pdo), new AppointmentChecklistAnswer($this->pdo), $clock),
            new AppointmentNotifier($mail, $config, $clock),
            $this->audit,
            $clock
        );
        $this->controller->setRequestValidator(new RequestValidator($this->audit));
    }

    protected function tearDown(): void
    {
        foreach (['mail.log', 'app.log'] as $file) {
            @unlink($this->tmp . '/' . $file);
        }
        @rmdir($this->tmp);
    }

    private function request(string $method, string $path, array $body, string $userId = self::PATIENT_USER, string $role = 'patient', array $params = []): Request
    {
        $request = new Request($method, $path, [], ['content-type' => 'application/json'], (string) json_encode($body));
        $request->setUser(['id' => $userId, 'role' => $role, 'email' => 'patient@diagnocare.test', 'full_name' => 'Dev Patient', 'phone' => '9000000004', 'email_verified_at' => '2026-10-01']);
        $request->setAttribute('route_params', $params);
        return $request;
    }

    private function validBody(array $overrides = []): array
    {
        return array_merge([
            'scan_type_id' => self::SCAN,
            'slot_id' => self::SLOT,
            'consent' => true,
            'patient_notes' => 'First visit.',
            'answers' => [self::ALLERGY => 'no'],
        ], $overrides);
    }

    public static function maliciousBookings(): array
    {
        return [
            'tautology in notes' => [['patient_notes' => "' OR '1'='1"], 'patient_notes', 'security.sqli_attempt'],
            'drop table in notes' => [['patient_notes' => "'; DROP TABLE users;--"], 'patient_notes', 'security.sqli_attempt'],
            'script tag in notes' => [['patient_notes' => '<script>alert(1)</script>'], 'patient_notes', 'security.xss_attempt'],
            'union select in slot id' => [['slot_id' => "1 UNION SELECT password_hash FROM users"], 'slot_id', 'security.sqli_attempt'],
            'script in checklist answer' => [['answers' => [self::ALLERGY => '<img src=x onerror=alert(1)>']], 'answers.' . self::ALLERGY, 'security.xss_attempt'],
            'oversized notes' => [['patient_notes' => str_repeat('a', 1001)], 'patient_notes', null],
            'missing consent' => [['consent' => false], 'consent', null],
            'unknown checklist option' => [['answers' => [self::ALLERGY => 'maybe']], 'answers.' . self::ALLERGY, null],
            'answers sent as a list' => [['answers' => ['no']], 'answers', null],
        ];
    }

    #[DataProvider('maliciousBookings')]
    public function testRejectsBadInputAndWritesNothing(array $overrides, string $field, ?string $auditAction): void
    {
        try {
            $this->controller->store($this->request('POST', '/api/v1/appointments', $this->validBody($overrides)));
            self::fail('Expected a validation error');
        } catch (ValidationException $e) {
            self::assertArrayHasKey($field, $e->fields());
        }
        self::assertSame([], $this->pdo->writes());
        self::assertFileDoesNotExist($this->tmp . '/mail.log');
        if ($auditAction !== null) {
            self::assertContains($auditAction, $this->audit->actions());
        }
    }

    public function testPatientCannotOpenAnotherPatientsAppointment(): void
    {
        $this->pdo->on('FROM appointments a', [['id' => self::APPOINTMENT, 'patient_user_id' => self::OTHER_USER]]);
        $this->expectException(NotFoundException::class);
        $this->controller->show($this->request('GET', '/api/v1/appointments/' . self::APPOINTMENT, [], self::PATIENT_USER, 'patient', ['id' => self::APPOINTMENT]));
    }

    public function testPatientCannotCancelAnotherPatientsAppointment(): void
    {
        $this->pdo->on('FROM appointments a', [['id' => self::APPOINTMENT, 'patient_user_id' => self::OTHER_USER]]);
        try {
            $this->controller->cancel($this->request('PATCH', '/api/v1/appointments/' . self::APPOINTMENT . '/cancel', [], self::PATIENT_USER, 'patient', ['id' => self::APPOINTMENT]));
            self::fail('Expected not found');
        } catch (NotFoundException) {
            self::assertSame([], $this->pdo->writes());
        }
    }

    public function testReferrerCannotDownloadCalendarFile(): void
    {
        $this->pdo->on('FROM appointments a', [['id' => self::APPOINTMENT, 'patient_user_id' => self::PATIENT_USER]]);
        $this->expectException(NotFoundException::class);
        $this->controller->ics($this->request('GET', '/api/v1/appointments/' . self::APPOINTMENT . '/ics', [], self::OTHER_USER, 'referrer', ['id' => self::APPOINTMENT]));
    }
}
