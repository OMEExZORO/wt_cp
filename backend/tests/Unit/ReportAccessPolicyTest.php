<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Controllers\ReportController;
use App\Core\Request;
use App\Exceptions\NotFoundException;
use App\Models\Appointment;
use App\Models\Referral;
use App\Models\Report;
use App\Models\ReportAccessLog;
use App\Services\EncryptionService;
use App\Services\Reports\ReportAccessPolicy;
use App\Services\Reports\ReportPresenter;
use App\Services\Reports\ReportService;
use App\Services\Reports\UploadedFileValidator;
use App\Validation\RequestValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakePdo;
use Tests\Support\InMemoryAuditLogger;
use Tests\Support\InMemoryStorage;

final class ReportAccessPolicyTest extends TestCase
{
    private const REPORT = '7c6d5e4f-3a2b-4c1d-8e9f-0a1b2c3d4e5f';
    private const PATIENT_A = '00000000-0000-4000-8000-0000000000a1';
    private const PATIENT_B = '00000000-0000-4000-8000-0000000000b2';
    private const REFERRER_1 = '00000000-0000-4000-8000-0000000000c1';
    private const REFERRER_2 = '00000000-0000-4000-8000-0000000000c2';
    private const PDF = "%PDF-1.4\nbody\n%%EOF\n";

    private FakePdo $pdo;
    private InMemoryStorage $storage;
    private EncryptionService $crypto;

    public static function matrix(): array
    {
        $a = ['id' => self::PATIENT_A, 'role' => 'patient'];
        $b = ['id' => self::PATIENT_B, 'role' => 'patient'];
        $r1 = ['id' => self::REFERRER_1, 'role' => 'referrer'];
        $r2 = ['id' => self::REFERRER_2, 'role' => 'referrer'];
        $report = ['status' => 'final', 'patient_user_id' => self::PATIENT_A, 'referrer_user_id' => self::REFERRER_1, 'deleted_at' => null];
        return [
            'owner patient' => [$a, $report, true],
            'other patient' => [$b, $report, false],
            'linked referrer' => [$r1, $report, true],
            'unrelated referrer' => [$r2, $report, false],
            'doctor' => [['id' => 'd', 'role' => 'doctor'], $report, true],
            'receptionist' => [['id' => 'x', 'role' => 'receptionist'], $report, true],
            'admin' => [['id' => 'y', 'role' => 'admin'], $report, true],
            'owner patient draft' => [$a, ['status' => 'draft'] + $report, false],
            'linked referrer draft' => [$r1, ['status' => 'draft'] + $report, false],
            'doctor draft' => [['id' => 'd', 'role' => 'doctor'], ['status' => 'draft'] + $report, true],
            'amended report released' => [$a, ['status' => 'amended'] + $report, true],
            'deleted for admin' => [['id' => 'y', 'role' => 'admin'], ['deleted_at' => '2026-10-09'] + $report, false],
            'report without referrer' => [$r1, ['referrer_user_id' => null] + $report, false],
            'unknown role' => [['id' => 'z', 'role' => 'guest'], $report, false],
            'missing user id' => [['role' => 'patient'], $report, false],
        ];
    }

    #[DataProvider('matrix')]
    public function testPolicyMatrix(array $user, array $report, bool $expected): void
    {
        self::assertSame($expected, ReportAccessPolicy::canView($user, $report));
    }

    public function testOnlyAdminCanDelete(): void
    {
        self::assertTrue(ReportAccessPolicy::canDelete(['role' => 'admin']));
        foreach (['doctor', 'receptionist', 'patient', 'referrer'] as $role) {
            self::assertFalse(ReportAccessPolicy::canDelete(['role' => $role]));
        }
    }

    private function controller(): ReportController
    {
        $this->pdo = new FakePdo();
        $this->storage = new InMemoryStorage();
        $this->crypto = new EncryptionService(EncryptionService::generateKey());
        $sealed = $this->crypto->encrypt(self::PDF);
        $path = 'reports/2026/10/' . bin2hex(random_bytes(16)) . '.bin';
        $this->storage->put($path, $sealed['ciphertext']);
        $this->pdo->on('FROM reports r', [[
            'id' => self::REPORT, 'appointment_id' => 'ap', 'patient_id' => 'pt', 'title' => 'CT', 'original_filename' => 'ct.pdf',
            'storage_path' => $path, 'mime_type' => 'application/pdf', 'size_bytes' => strlen(self::PDF), 'sha256' => hash('sha256', self::PDF),
            'encryption_iv' => base64_encode($sealed['iv']), 'encryption_tag' => base64_encode($sealed['tag']), 'key_version' => 1,
            'findings_encrypted' => null, 'impression_encrypted' => null, 'storage_driver' => 'local', 'status' => 'final',
            'is_critical' => false, 'released_at' => null, 'deleted_at' => null, 'created_at' => '2026-10-09 10:00:00+05:30',
            'updated_at' => '2026-10-09 10:00:00+05:30', 'patient_name' => 'Patient A', 'patient_user_id' => self::PATIENT_A,
            'appointment_reference' => 'MDC-261009-AAAAA', 'referral_id' => 'rf', 'scan_name' => 'CT', 'slot_date' => '2026-10-09',
            'referrer_user_id' => self::REFERRER_1, 'referrer_id' => 'rr',
        ]]);
        $audit = new InMemoryAuditLogger();
        $reports = new Report($this->pdo);
        $controller = new ReportController(
            $reports,
            new Appointment($this->pdo),
            new ReportAccessLog($this->pdo),
            new ReportService($reports, new Referral($this->pdo), new ReportAccessLog($this->pdo), $this->storage, $this->crypto),
            new ReportPresenter($this->crypto),
            new UploadedFileValidator(UploadedFileValidator::MAX_BYTES, false),
            $audit
        );
        $controller->setRequestValidator(new RequestValidator($audit));
        return $controller;
    }

    private function request(string $id, string $role, string $path = ''): Request
    {
        $request = new Request('GET', '/api/v1/reports/' . self::REPORT . $path, [], [], '', [], [], [], '127.0.0.1');
        $request->setUser(['id' => $id, 'role' => $role]);
        $request->setAttribute('route_params', ['id' => self::REPORT]);
        return $request;
    }

    public function testOwnerDownloadsDecryptedBytesWithHardenedHeaders(): void
    {
        $response = $this->controller()->download($this->request(self::PATIENT_A, 'patient', '/download'));
        self::assertSame(self::PDF, $response->body());
        self::assertSame('application/pdf', $response->header('Content-Type'));
        self::assertSame('nosniff', $response->header('X-Content-Type-Options'));
        self::assertStringContainsString('no-store', (string) $response->header('Cache-Control'));
        self::assertStringStartsWith('attachment;', (string) $response->header('Content-Disposition'));
        self::assertTrue($this->wrote('INSERT INTO report_access_log'));
    }

    public function testPatientCannotDownloadAnotherPatientsReport(): void
    {
        $controller = $this->controller();
        try {
            $controller->download($this->request(self::PATIENT_B, 'patient', '/download'));
            self::fail('Expected not found');
        } catch (NotFoundException) {
            self::assertTrue($this->wrote('INSERT INTO report_access_log'));
        }
    }

    public function testPatientCannotViewAnotherPatientsReportDetails(): void
    {
        $this->expectException(NotFoundException::class);
        $this->controller()->show($this->request(self::PATIENT_B, 'patient'));
    }

    public function testLinkedReferrerCanDownloadButUnrelatedReferrerCannot(): void
    {
        $controller = $this->controller();
        self::assertSame(self::PDF, $controller->download($this->request(self::REFERRER_1, 'referrer', '/download'))->body());
        $this->expectException(NotFoundException::class);
        $controller->download($this->request(self::REFERRER_2, 'referrer', '/download'));
    }

    public function testForgedIdForUnknownReportIsNotFound(): void
    {
        $controller = $this->controller();
        $this->pdo->on('FROM reports r', []);
        $this->expectException(NotFoundException::class);
        $controller->download($this->request(self::REFERRER_2, 'referrer', '/download'));
    }

    public function testNonAdminCannotDelete(): void
    {
        $controller = $this->controller();
        $this->expectException(NotFoundException::class);
        $controller->destroy($this->request('doc', 'doctor'));
    }

    public function testTamperedStoredFileFailsClosed(): void
    {
        $controller = $this->controller();
        $path = array_key_first($this->storage->objects);
        $this->storage->objects[$path][0] = $this->storage->objects[$path][0] ^ "\x01";
        $this->expectException(\App\Exceptions\EncryptionException::class);
        $controller->download($this->request(self::PATIENT_A, 'patient', '/download'));
    }

    private function wrote(string $needle): bool
    {
        foreach ($this->pdo->writes() as $sql) {
            if (str_contains($sql, $needle)) {
                return true;
            }
        }
        return false;
    }
}
