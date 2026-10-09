<?php

declare(strict_types=1);

namespace Tests\Unit;

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

final class ReportUploadTest extends TestCase
{
    private const APPOINTMENT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
    private const PATIENT = '3f2b1a09-8c7d-4e6f-9a5b-4c3d2e1f0a9b';
    private const REPORT = '7c6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f';
    private const DOCTOR = '00000000-0000-4000-8000-000000000002';
    private const PDF = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";

    private FakePdo $pdo;
    private InMemoryStorage $storage;
    private InMemoryAuditLogger $audit;
    private EncryptionService $crypto;
    private array $tmpFiles = [];

    protected function setUp(): void
    {
        $this->pdo = new FakePdo();
        $this->pdo->on('FROM appointments a', [[
            'id' => self::APPOINTMENT, 'patient_id' => self::PATIENT, 'status' => 'confirmed', 'referral_id' => null,
        ]]);
        $this->storage = new InMemoryStorage();
        $this->audit = new InMemoryAuditLogger();
        $this->crypto = new EncryptionService(EncryptionService::generateKey());
    }

    protected function tearDown(): void
    {
        foreach ($this->tmpFiles as $file) {
            @unlink($file);
        }
    }

    private function controller(?UploadedFileValidator $validator = null): ReportController
    {
        $reports = new Report($this->pdo);
        $service = new ReportService($reports, new Referral($this->pdo), new ReportAccessLog($this->pdo), $this->storage, $this->crypto);
        $controller = new ReportController(
            $reports,
            new Appointment($this->pdo),
            new ReportAccessLog($this->pdo),
            $service,
            new ReportPresenter($this->crypto),
            $validator ?? new UploadedFileValidator(UploadedFileValidator::MAX_BYTES, false),
            $this->audit
        );
        $controller->setRequestValidator(new RequestValidator($this->audit));
        return $controller;
    }

    private function upload(string $name, string $contents, array $fields = []): Request
    {
        $path = tempnam(sys_get_temp_dir(), 'dcup');
        file_put_contents($path, $contents);
        $this->tmpFiles[] = $path;
        $files = ['file' => ['name' => $name, 'type' => 'application/pdf', 'tmp_name' => $path, 'error' => UPLOAD_ERR_OK, 'size' => strlen($contents)]];
        $form = array_merge(['appointment_id' => self::APPOINTMENT, 'title' => 'CT Brain report', 'status' => 'final'], $fields);
        $request = new Request('POST', '/api/v1/reports', [], ['content-type' => 'multipart/form-data; boundary=x'], '', $form, [], $files);
        $request->setUser(['id' => self::DOCTOR, 'role' => 'doctor', 'full_name' => 'Dev Doctor']);
        return $request;
    }

    private function assertNothingWritten(): void
    {
        self::assertSame([], $this->pdo->writes());
        self::assertSame([], $this->storage->objects);
    }

    public function testTextFileBehindPdfExtensionIsRejectedAndNothingIsWritten(): void
    {
        try {
            $this->controller()->store($this->upload('scan.pdf', "just some plain text pretending to be a report\n"));
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('file', $e->fields());
        }
        $this->assertNothingWritten();
    }

    public function testPhpScriptBehindPdfExtensionIsRejected(): void
    {
        $this->expectException(ValidationException::class);
        try {
            $this->controller()->store($this->upload('shell.pdf', "<?php system(\$_GET['c']); ?>"));
        } finally {
            $this->assertNothingWritten();
        }
    }

    public function testPdfContentsWithImageExtensionIsRejected(): void
    {
        try {
            $this->controller()->store($this->upload('scan.png', self::PDF));
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertStringContainsString('extension', $e->fields()['file']);
        }
        $this->assertNothingWritten();
    }

    public static function dangerousNames(): array
    {
        return [['report.php.pdf'], ['report.phtml.pdf'], ['report.exe.pdf'], ['report.html.pdf'], ['..\\..\\report.sh.pdf']];
    }

    #[DataProvider('dangerousNames')]
    public function testExecutableLookingNamesAreRejected(string $name): void
    {
        try {
            $this->controller()->store($this->upload($name, self::PDF));
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('file', $e->fields());
        }
        $this->assertNothingWritten();
    }

    public function testOversizeFileIsRejectedAndNothingIsWritten(): void
    {
        $controller = $this->controller(new UploadedFileValidator(1024, false));
        try {
            $controller->store($this->upload('big.pdf', self::PDF . str_repeat('A', 2048)));
            self::fail('Expected rejection');
        } catch (PayloadTooLargeException $e) {
            self::assertSame(413, $e->status());
        }
        $this->assertNothingWritten();
    }

    public function testDeclaredOversizeRequestIsRejectedBeforeReading(): void
    {
        $request = new Request('POST', '/api/v1/reports', [], ['content-type' => 'multipart/form-data', 'content-length' => '99999999'], '', [], [], []);
        $request->setUser(['id' => self::DOCTOR, 'role' => 'doctor']);
        $this->expectException(PayloadTooLargeException::class);
        $this->controller()->store($request);
    }

    public function testMissingFileIsRejected(): void
    {
        $request = new Request('POST', '/api/v1/reports', [], ['content-type' => 'multipart/form-data'], '', ['appointment_id' => self::APPOINTMENT, 'title' => 'CT Brain report'], [], []);
        $request->setUser(['id' => self::DOCTOR, 'role' => 'doctor']);
        try {
            $this->controller()->store($request);
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('file', $e->fields());
        }
        $this->assertNothingWritten();
    }

    public static function maliciousFields(): array
    {
        return [
            'script in title' => [['title' => '<script>alert(1)</script>'], 'title'],
            'sql in title' => [['title' => "'; DROP TABLE users;--"], 'title'],
            'bad appointment id' => [['appointment_id' => "1' OR '1'='1"], 'appointment_id'],
            'bad status' => [['status' => 'published'], 'status'],
            'html in notes' => [['notes' => '<img src=x onerror=alert(1)>'], 'notes'],
        ];
    }

    #[DataProvider('maliciousFields')]
    public function testMaliciousMetadataIsRejectedBeforeAnyWrite(array $fields, string $field): void
    {
        try {
            $this->controller()->store($this->upload('scan.pdf', self::PDF, $fields));
            self::fail('Expected rejection');
        } catch (ValidationException $e) {
            self::assertArrayHasKey($field, $e->fields());
        }
        $this->assertNothingWritten();
    }

    public function testValidPdfIsStoredEncryptedWithRandomName(): void
    {
        $detail = [
            'id' => self::REPORT, 'appointment_id' => self::APPOINTMENT, 'patient_id' => self::PATIENT, 'title' => 'CT Brain report',
            'original_filename' => 'scan.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => strlen(self::PDF),
            'is_critical' => false, 'status' => 'final', 'released_at' => null, 'created_at' => '2026-10-09 10:00:00+05:30',
            'updated_at' => '2026-10-09 10:00:00+05:30', 'patient_name' => 'Dev Patient', 'appointment_reference' => 'MDC-261009-AAAAA',
            'scan_name' => 'CT Brain', 'slot_date' => '2026-10-09', 'referrer_id' => null,
            'findings_encrypted' => $this->crypto->encryptText('secret clinical note'), 'impression_encrypted' => null,
        ];
        $this->pdo->on('INSERT INTO reports', [['id' => self::REPORT]]);
        $this->pdo->on('FROM reports r', [$detail]);

        $response = $this->controller()->store($this->upload('scan.pdf', self::PDF, ['notes' => 'secret clinical note']));

        self::assertSame(201, $response->status());
        self::assertCount(1, $this->storage->objects);
        $path = array_key_first($this->storage->objects);
        self::assertMatchesRegularExpression('#^reports/\d{4}/\d{2}/[a-f0-9]{32}\.bin$#', $path);
        self::assertStringNotContainsString('scan', $path);
        $stored = $this->storage->objects[$path];
        self::assertStringNotContainsString('%PDF', $stored);
        self::assertSame(strlen(self::PDF), strlen($stored));
        self::assertContains('report.uploaded', $this->audit->actions());
        self::assertSame('secret clinical note', $response->decoded()['data']['report']['notes']);
    }
}
