<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Controllers\AuthController;
use App\Controllers\ReportController;
use App\Core\Request;
use App\Exceptions\PayloadTooLargeException;
use App\Exceptions\ValidationException;
use App\Models\Appointment;
use App\Models\Referral;
use App\Models\Report;
use App\Models\ReportAccessLog;
use App\Services\EncryptionService;
use App\Services\Reports\ReportPresenter;
use App\Services\Reports\ReportService;
use App\Services\Reports\UploadedFileValidator;
use App\Validation\RequestValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakePdo;
use Tests\Support\InMemoryAuditLogger;
use Tests\Support\InMemoryStorage;

final class ValidationAttackMatrixTest extends TestCase
{
    private const APPOINTMENT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
    private const PATIENT = '3f2b1a09-8c7d-4e6f-9a5b-4c3d2e1f0a9b';
    private const DOCTOR = '00000000-0000-4000-8000-000000000002';
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    private FakePdo $pdo;
    private InMemoryStorage $storage;
    private InMemoryAuditLogger $audit;
    private array $tmpFiles = [];

    protected function setUp(): void
    {
        $this->pdo = new FakePdo();
        $this->pdo->on('FROM appointments a', [[
            'id' => self::APPOINTMENT, 'patient_id' => self::PATIENT, 'status' => 'confirmed', 'referral_id' => null,
        ]]);
        $this->storage = new InMemoryStorage();
        $this->audit = new InMemoryAuditLogger();
    }

    protected function tearDown(): void
    {
        foreach ($this->tmpFiles as $file) {
            @unlink($file);
        }
    }

    public static function attacks(): array
    {
        return [
            'sql tautology' => ["' OR '1'='1", 'security.sqli_attempt'],
            'drop table' => ["'; DROP TABLE users;--", 'security.sqli_attempt'],
            'script tag' => ['<script>alert(1)</script>', 'security.xss_attempt'],
            'oversized input' => [str_repeat('A', 20000), null],
        ];
    }

    private function validator(): RequestValidator
    {
        return new RequestValidator($this->audit);
    }

    private function registrationBody(array $override): array
    {
        return array_merge([
            'account_type' => 'patient',
            'full_name' => 'Asha Kulkarni',
            'email' => 'asha@example.com',
            'phone' => '9876543210',
            'password' => 'Str0ng!Passw0rd',
            'password_confirmation' => 'Str0ng!Passw0rd',
            'consent' => true,
            'city' => 'Pune',
        ], $override);
    }

    #[DataProvider('attacks')]
    public function testRegistrationRejectsAttackInName(string $payload, ?string $auditAction): void
    {
        $rules = array_merge(AuthController::ACCOUNT_RULES, AuthController::PATIENT_RULES);
        $request = new Request('POST', '/api/v1/auth/register', [], [], '', $this->registrationBody(['full_name' => $payload]));
        try {
            $this->validator()->validate($request, $rules);
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('full_name', $e->fields());
        }
        if ($auditAction !== null) {
            self::assertContains($auditAction, $this->audit->actions());
        }
        self::assertSame([], $this->pdo->writes());
    }

    #[DataProvider('attacks')]
    public function testRegistrationRejectsAttackInEmail(string $payload): void
    {
        $rules = array_merge(AuthController::ACCOUNT_RULES, AuthController::PATIENT_RULES);
        $request = new Request('POST', '/api/v1/auth/register', [], [], '', $this->registrationBody(['email' => $payload]));
        try {
            $this->validator()->validate($request, $rules);
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('email', $e->fields());
        }
        self::assertSame([], $this->pdo->writes());
    }

    #[DataProvider('attacks')]
    public function testRegistrationRejectsAttackInCity(string $payload): void
    {
        $rules = array_merge(AuthController::ACCOUNT_RULES, AuthController::PATIENT_RULES);
        $request = new Request('POST', '/api/v1/auth/register', [], [], '', $this->registrationBody(['city' => $payload]));
        try {
            $this->validator()->validate($request, $rules);
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('city', $e->fields());
        }
    }

    #[DataProvider('attacks')]
    public function testReferrerRegistrationRejectsAttackInClinicName(string $payload): void
    {
        $rules = array_merge(AuthController::ACCOUNT_RULES, AuthController::REFERRER_RULES);
        $body = $this->registrationBody(['account_type' => 'referrer', 'qualification' => 'MBBS', 'registration_number' => 'MMC/2012/12345', 'clinic_name' => $payload]);
        $request = new Request('POST', '/api/v1/auth/register', [], [], '', $body);
        try {
            $this->validator()->validate($request, $rules);
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('clinic_name', $e->fields());
        }
    }

    public function testRegistrationWithoutConsentIsRejected(): void
    {
        $rules = array_merge(AuthController::ACCOUNT_RULES, AuthController::PATIENT_RULES);
        $request = new Request('POST', '/api/v1/auth/register', [], [], '', $this->registrationBody(['consent' => false]));
        try {
            $this->validator()->validate($request, $rules);
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('consent', $e->fields());
        }
    }

    public function testValidRegistrationBodyPasses(): void
    {
        $rules = array_merge(AuthController::ACCOUNT_RULES, AuthController::PATIENT_RULES);
        $request = new Request('POST', '/api/v1/auth/register', [], [], '', $this->registrationBody([]));
        $data = $this->validator()->validate($request, $rules);
        self::assertSame('asha@example.com', $data['email']);
    }

    private function controller(): ReportController
    {
        $crypto = new EncryptionService(EncryptionService::generateKey());
        $reports = new Report($this->pdo);
        $service = new ReportService($reports, new Referral($this->pdo), new ReportAccessLog($this->pdo), $this->storage, $crypto);
        $controller = new ReportController(
            $reports,
            new Appointment($this->pdo),
            new ReportAccessLog($this->pdo),
            $service,
            new ReportPresenter($crypto),
            new UploadedFileValidator(UploadedFileValidator::MAX_BYTES, false),
            $this->audit
        );
        $controller->setRequestValidator($this->validator());
        return $controller;
    }

    private function upload(string $name, string $contents, array $fields = []): Request
    {
        $path = tempnam(sys_get_temp_dir(), 'dcatk');
        file_put_contents($path, $contents);
        $this->tmpFiles[] = $path;
        $files = ['file' => ['name' => $name, 'type' => 'application/pdf', 'tmp_name' => $path, 'error' => UPLOAD_ERR_OK, 'size' => strlen($contents)]];
        $form = array_merge(['appointment_id' => self::APPOINTMENT, 'title' => 'Attack probe', 'status' => 'final'], $fields);
        $request = new Request('POST', '/api/v1/reports', [], ['content-type' => 'multipart/form-data; boundary=x'], '', $form, [], $files);
        $request->setUser(['id' => self::DOCTOR, 'role' => 'doctor', 'full_name' => 'Dev Doctor']);
        return $request;
    }

    #[DataProvider('attacks')]
    public function testReportTitleAttacksAreRejectedAndNothingIsStored(string $payload): void
    {
        try {
            $this->controller()->store($this->upload('ok.pdf', "%PDF-1.4\n%%EOF\n", ['title' => $payload]));
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('title', $e->fields());
        }
        self::assertSame([], $this->pdo->writes());
        self::assertSame([], $this->storage->objects);
    }

    public function testOversizedNotesAreRejectedAndNothingIsStored(): void
    {
        try {
            $this->controller()->store($this->upload('ok.pdf', "%PDF-1.4\n%%EOF\n", ['notes' => str_repeat('n', 5001)]));
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('notes', $e->fields());
        }
        self::assertSame([], $this->pdo->writes());
        self::assertSame([], $this->storage->objects);
    }

    public static function wrongMimeFiles(): array
    {
        return [
            'plain text named pdf' => ['report.pdf', "plain text pretending to be a report\n"],
            'real PNG named pdf' => ['report.pdf', base64_decode(self::PNG)],
            'PHP script named pdf' => ['report.pdf', "<?php system(\$_GET['c']); ?>"],
            'HTML with script named pdf' => ['report.pdf', '<html><script>alert(1)</script></html>'],
            'SVG with script named pdf' => ['report.pdf', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
            'empty file named pdf' => ['report.pdf', ''],
        ];
    }

    #[DataProvider('wrongMimeFiles')]
    public function testWrongMimeFileWithPdfExtensionIsRejectedAndNothingIsStored(string $name, string $contents): void
    {
        try {
            $this->controller()->store($this->upload($name, $contents));
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('file', $e->fields());
        }
        self::assertSame([], $this->pdo->writes());
        self::assertSame([], $this->storage->objects);
    }

    public function testElevenMegabyteFileIsRejectedWith413AndNothingIsStored(): void
    {
        $contents = "%PDF-1.4\n" . str_repeat('A', 11 * 1048576);
        try {
            $this->controller()->store($this->upload('huge.pdf', $contents));
            self::fail('Expected rejection');
        } catch (PayloadTooLargeException $e) {
            self::assertSame(413, $e->status());
        }
        self::assertSame([], $this->pdo->writes());
        self::assertSame([], $this->storage->objects);
    }
}
