<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Controllers\Admin\FaqAdminController;
use App\Controllers\Admin\ReviewAdminController;
use App\Controllers\Admin\SlotAdminController;
use App\Controllers\Admin\UserAdminController;
use App\Controllers\PublicController;
use App\Core\Config;
use App\Core\Logger;
use App\Core\Request;
use App\Exceptions\ConflictException;
use App\Exceptions\PayloadTooLargeException;
use App\Exceptions\ValidationException;
use App\Models\AdminRepository;
use App\Models\Branch;
use App\Models\Faq;
use App\Models\PasswordReset;
use App\Models\Review;
use App\Models\ScanCategory;
use App\Models\ScanType;
use App\Models\Slot;
use App\Models\SiteSetting;
use App\Models\User;
use App\Services\Admin\ImageUploadStore;
use App\Services\Mail\LogMailer;
use App\Services\Mail\MailService;
use App\Validation\RequestValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakePdo;
use Tests\Support\InMemoryAuditLogger;

final class AdminContentTest extends TestCase
{
    private const ADMIN = '00000000-0000-4000-8000-000000000001';
    private const SLOT = '5d0a8f3e-1b2c-4d3e-8f4a-5b6c7d8e9f00';
    private const OTHER = '11111111-1111-4111-8111-111111111111';
    private string $tmp;

    protected function setUp(): void
    {
        $this->tmp = sys_get_temp_dir() . '/dc-admin-' . bin2hex(random_bytes(4));
        mkdir($this->tmp, 0777, true);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->tmp . '/*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($this->tmp);
    }

    private function request(string $method, string $path, array $body = [], array $params = [], array $query = []): Request
    {
        $request = new Request($method, $path, $query, ['content-type' => 'application/json'], (string) json_encode($body));
        $request->setUser(['id' => self::ADMIN, 'role' => 'admin', 'full_name' => 'Dev Admin']);
        $request->setAttribute('route_params', $params);
        return $request;
    }

    public static function badFaqs(): array
    {
        return [
            'script' => [['question' => '<script>alert(1)</script>', 'answer' => 'A valid answer.', 'category' => 'general'], 'question'],
            'tautology' => [['question' => "' OR '1'='1", 'answer' => 'A valid answer.', 'category' => 'general'], 'question'],
            'drop table' => [['question' => 'Valid question here?', 'answer' => "'; DROP TABLE users;--", 'category' => 'general'], 'answer'],
            'unknown category' => [['question' => 'Valid question here?', 'answer' => 'A valid answer.', 'category' => 'secret'], 'category'],
            'too short' => [['question' => 'Hi', 'answer' => 'A valid answer.', 'category' => 'general'], 'question'],
            'oversized answer' => [['question' => 'Valid question here?', 'answer' => str_repeat('a', 2001), 'category' => 'general'], 'answer'],
            'missing answer' => [['question' => 'Valid question here?', 'category' => 'general'], 'answer'],
        ];
    }

    #[DataProvider('badFaqs')]
    public function testFaqCreateRejectsBadInputAndWritesNothing(array $body, string $field): void
    {
        $pdo = new FakePdo();
        $audit = new InMemoryAuditLogger();
        $controller = new FaqAdminController($audit, new Faq($pdo), new AdminRepository($pdo));
        $controller->setRequestValidator(new RequestValidator($audit));
        try {
            $controller->store($this->request('POST', '/api/v1/admin/faqs', $body));
            self::fail('Expected a validation error');
        } catch (ValidationException $e) {
            self::assertArrayHasKey($field, $e->fields());
        }
        self::assertSame([], $pdo->writes());
    }

    public function testFaqCreateIsAudited(): void
    {
        $pdo = new FakePdo();
        $pdo->on('INSERT INTO faqs', [['id' => 'f-1', 'question' => 'Valid question here?', 'answer' => 'A valid answer.', 'category' => 'general', 'sort_order' => 0, 'is_published' => true]]);
        $audit = new InMemoryAuditLogger();
        $controller = new FaqAdminController($audit, new Faq($pdo), new AdminRepository($pdo));
        $controller->setRequestValidator(new RequestValidator($audit));
        $response = $controller->store($this->request('POST', '/api/v1/admin/faqs', ['question' => 'Valid question here?', 'answer' => 'A valid answer.', 'category' => 'general']));
        self::assertSame(201, $response->status());
        self::assertSame(['admin.faq_created'], $audit->actions());
    }

    private function reviewController(FakePdo $pdo, InMemoryAuditLogger $audit): ReviewAdminController
    {
        $controller = new ReviewAdminController($audit, new Review($pdo), new AdminRepository($pdo));
        $controller->setRequestValidator(new RequestValidator($audit));
        return $controller;
    }

    private function googleBody(): array
    {
        return ['display_name' => 'Asha K', 'rating' => 5, 'body' => 'Calm staff and a clear explanation of the scan.', 'external_review_date' => '2026-09-01', 'source_url' => 'https://maps.app.goo.gl/example'];
    }

    public function testGoogleReviewIsCreatedApprovedAndUnverified(): void
    {
        $pdo = new FakePdo();
        $pdo->on('INSERT INTO reviews', [['id' => 'r-1', 'display_name' => 'Asha K', 'rating' => 5, 'body' => 'Calm staff and a clear explanation of the scan.', 'status' => 'approved', 'verified_visit' => false, 'is_demo' => false, 'source' => 'google', 'source_url' => 'https://maps.app.goo.gl/example', 'external_review_date' => '2026-09-01', 'reviewer_photo_url' => null]]);
        $audit = new InMemoryAuditLogger();
        $response = $this->reviewController($pdo, $audit)->store($this->request('POST', '/api/v1/admin/reviews', $this->googleBody()));
        self::assertSame(201, $response->status());
        self::assertSame(['admin.review_created'], $audit->actions());
        $inserts = array_filter($pdo->statements, static fn (string $sql): bool => str_starts_with($sql, 'INSERT INTO reviews'));
        self::assertNotEmpty($inserts);
        foreach ($inserts as $sql) {
            self::assertStringContainsString('source', $sql);
        }
    }

    public function testGoogleReviewRejectsNonHttpsLinkAndFutureDate(): void
    {
        foreach ([['source_url' => 'http://example.com/r'], ['external_review_date' => '2999-01-01'], ['rating' => 6]] as $override) {
            $pdo = new FakePdo();
            $audit = new InMemoryAuditLogger();
            try {
                $this->reviewController($pdo, $audit)->store($this->request('POST', '/api/v1/admin/reviews', $override + $this->googleBody()));
                self::fail('Expected a validation error');
            } catch (ValidationException $e) {
                self::assertArrayHasKey(array_key_first($override), $e->fields());
            }
            self::assertSame([], $pdo->writes());
        }
    }

    public function testSiteReviewsCannotBeEditedAsGoogleReviews(): void
    {
        $pdo = new FakePdo();
        $pdo->on('FROM reviews WHERE', [['id' => self::OTHER, 'source' => 'site', 'status' => 'approved']]);
        $this->expectException(ValidationException::class);
        $this->reviewController($pdo, new InMemoryAuditLogger())->update($this->request('PUT', '/api/v1/admin/reviews/' . self::OTHER, $this->googleBody(), ['id' => self::OTHER]));
    }

    private function slotController(FakePdo $pdo, InMemoryAuditLogger $audit): SlotAdminController
    {
        $controller = new SlotAdminController($audit, new AdminRepository($pdo), new Slot($pdo), new Branch($pdo));
        $controller->setRequestValidator(new RequestValidator($audit));
        return $controller;
    }

    private function slotRow(int $capacity, int $booked): array
    {
        return ['id' => self::SLOT, 'branch_id' => 'b-1', 'modality' => 'USG', 'slot_date' => '2026-10-12', 'start_time' => '09:00:00', 'end_time' => '09:30:00', 'capacity' => $capacity, 'booked_count' => $booked, 'is_blocked' => false, 'branch_name' => 'MDC'];
    }

    public function testCapacityCannotDropBelowExistingBookings(): void
    {
        $pdo = new FakePdo();
        $pdo->on('FROM slots s JOIN branches b ON b.id = s.branch_id WHERE s.id', [$this->slotRow(3, 2)]);
        $pdo->on('FROM slots WHERE id = :id FOR UPDATE', [['id' => self::SLOT, 'capacity' => 3, 'booked_count' => 2, 'is_blocked' => false]]);
        $audit = new InMemoryAuditLogger();
        try {
            $this->slotController($pdo, $audit)->update($this->request('PATCH', '/api/v1/admin/slots/' . self::SLOT, ['capacity' => 1], ['id' => self::SLOT]));
            self::fail('Expected a conflict');
        } catch (ConflictException $e) {
            self::assertArrayHasKey('capacity', $e->fields());
        }
        self::assertNotContains('UPDATE slots SET capacity = :capacity, is_blocked = :blocked WHERE id = :id', $pdo->statements);
        self::assertSame([], $audit->actions());
    }

    public function testSlotCapacityRejectsOutOfRangeAndInjection(): void
    {
        $pdo = new FakePdo();
        $controller = $this->slotController($pdo, new InMemoryAuditLogger());
        foreach ([0, 51, 'abc', "1; DROP TABLE slots"] as $capacity) {
            try {
                $controller->update($this->request('PATCH', '/api/v1/admin/slots/' . self::SLOT, ['capacity' => $capacity], ['id' => self::SLOT]));
                self::fail('Expected a validation error');
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }
        self::assertSame([], $pdo->writes());
    }

    public function testBulkGenerateRejectsPastDatesAndEmptyCapacity(): void
    {
        $pdo = new FakePdo();
        $controller = $this->slotController($pdo, new InMemoryAuditLogger());
        $base = ['from' => date('Y-m-d', strtotime('+1 day')), 'days' => 2, 'open' => '09:00', 'close' => '10:00', 'interval' => 30, 'capacity_usg' => 1];
        foreach ([
            array_merge($base, ['from' => '2020-01-01']),
            array_merge($base, ['capacity_usg' => 0]),
            array_merge($base, ['days' => 500]),
            array_merge($base, ['close' => '08:00']),
            array_merge($base, ['closed_weekdays' => '9']),
        ] as $body) {
            try {
                $controller->generate($this->request('POST', '/api/v1/admin/slots/generate', $body));
                self::fail('Expected a validation error');
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }
        self::assertSame([], $pdo->writes());
    }

    private function userController(FakePdo $pdo, InMemoryAuditLogger $audit): UserAdminController
    {
        $config = new Config(['frontend_url' => 'http://localhost:5173', 'auth' => ['reset_token_minutes' => 60]]);
        $mail = new MailService(new LogMailer($this->tmp . '/mail.log', 'test@example.com'), new Logger($this->tmp . '/app.log'), dirname(__DIR__, 2) . '/templates/emails');
        $remember = (new \ReflectionClass(\App\Services\RememberMeService::class))->newInstanceWithoutConstructor();
        $controller = new UserAdminController($audit, $config, new User($pdo), new AdminRepository($pdo), new PasswordReset($pdo), $remember, $mail);
        $controller->setRequestValidator(new RequestValidator($audit));
        return $controller;
    }

    public static function badUsers(): array
    {
        return [
            'patient role' => [['email' => 'a@example.com', 'full_name' => 'Asha Kulkarni', 'role' => 'patient', 'password' => 'Str0ng!Password'], 'role'],
            'weak password' => [['email' => 'a@example.com', 'full_name' => 'Asha Kulkarni', 'role' => 'doctor', 'password' => 'password'], 'password'],
            'bad email' => [['email' => 'not-an-email', 'full_name' => 'Asha Kulkarni', 'role' => 'doctor', 'password' => 'Str0ng!Password'], 'email'],
            'script name' => [['email' => 'a@example.com', 'full_name' => '<script>alert(1)</script>', 'role' => 'doctor', 'password' => 'Str0ng!Password'], 'full_name'],
            'bad phone' => [['email' => 'a@example.com', 'full_name' => 'Asha Kulkarni', 'role' => 'doctor', 'phone' => '123', 'password' => 'Str0ng!Password'], 'phone'],
        ];
    }

    #[DataProvider('badUsers')]
    public function testStaffCreationValidatesEveryField(array $body, string $field): void
    {
        $pdo = new FakePdo();
        $controller = $this->userController($pdo, new InMemoryAuditLogger());
        try {
            $controller->store($this->request('POST', '/api/v1/admin/users', $body));
            self::fail('Expected a validation error');
        } catch (ValidationException $e) {
            self::assertArrayHasKey($field, $e->fields());
        }
        self::assertSame([], $pdo->writes());
    }

    public function testAdminCannotDeactivateOrDemoteThemselves(): void
    {
        $pdo = new FakePdo();
        $pdo->on('FROM users WHERE id = :id', [['id' => self::ADMIN, 'email' => 'admin@example.com', 'full_name' => 'Dev Admin', 'phone' => null, 'role' => 'admin', 'is_active' => true, 'email_verified_at' => '2026-01-01', 'last_login_at' => null, 'created_at' => '2026-01-01 00:00:00+05:30']]);
        $controller = $this->userController($pdo, new InMemoryAuditLogger());
        foreach ([['is_active' => false], ['role' => 'doctor']] as $body) {
            try {
                $controller->update($this->request('PATCH', '/api/v1/admin/users/' . self::ADMIN, $body, ['id' => self::ADMIN]));
                self::fail('Expected a validation error');
            } catch (ValidationException) {
                $this->addToAssertionCount(1);
            }
        }
        self::assertSame([], $pdo->writes());
    }

    public function testPatientAccountsKeepTheirRole(): void
    {
        $pdo = new FakePdo();
        $pdo->on('FROM users WHERE id = :id', [['id' => self::OTHER, 'email' => 'p@example.com', 'full_name' => 'Pat Ient', 'phone' => null, 'role' => 'patient', 'is_active' => true, 'email_verified_at' => '2026-01-01', 'last_login_at' => null, 'created_at' => '2026-01-01 00:00:00+05:30']]);
        $this->expectException(ValidationException::class);
        $this->userController($pdo, new InMemoryAuditLogger())->update($this->request('PATCH', '/api/v1/admin/users/' . self::OTHER, ['role' => 'admin'], ['id' => self::OTHER]));
    }

    public function testPublicReviewsHideDemoRowsInProduction(): void
    {
        foreach (['production' => false, 'development' => true] as $env => $includesDemo) {
            $pdo = new FakePdo();
            $controller = new PublicController(
                new Config(['env' => $env]),
                new SiteSetting($pdo),
                new Branch($pdo),
                new ScanCategory($pdo),
                new ScanType($pdo),
                new Faq($pdo),
                new Review($pdo)
            );
            $controller->setRequestValidator(new RequestValidator(new InMemoryAuditLogger()));
            $controller->reviews(new Request('GET', '/api/v1/public/reviews'));
            $reviewQueries = array_filter($pdo->statements, static fn (string $sql): bool => str_contains($sql, 'FROM reviews'));
            self::assertNotEmpty($reviewQueries);
            foreach ($reviewQueries as $sql) {
                self::assertStringContainsString("status = 'approved'", $sql);
                self::assertSame($includesDemo, !str_contains($sql, 'is_demo = FALSE'), $env);
            }
        }
    }

    private function png(int $width, int $height): string
    {
        $rows = '';
        for ($y = 0; $y < $height; $y++) {
            $rows .= "\x00" . str_repeat("\x80\x90\xa0", $width);
        }
        $chunk = static fn (string $type, string $data): string => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
        return "\x89PNG\r\n\x1a\n" . $chunk('IHDR', pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0)) . $chunk('IDAT', (string) gzcompress($rows)) . $chunk('IEND', '');
    }

    private function upload(string $content, string $name = 'photo.png', int $error = UPLOAD_ERR_OK): array
    {
        $path = $this->tmp . '/' . bin2hex(random_bytes(4)) . '.tmp';
        file_put_contents($path, $content);
        return ['name' => $name, 'tmp_name' => $path, 'error' => $error, 'size' => strlen($content), 'type' => 'image/png'];
    }

    public function testImageStoreAcceptsARealPngAndNamesItRandomly(): void
    {
        $store = new ImageUploadStore($this->tmp . '/doctor', false);
        $saved = $store->save($this->upload($this->png(300, 300), 'my photo.png'));
        self::assertSame('image/png', $saved['mime']);
        self::assertMatchesRegularExpression('/^[a-f0-9]{32}\.png$/', $saved['name']);
        self::assertSame('image/png', $store->current()['mime']);
    }

    public function testImageStoreReplacesThePreviousPhoto(): void
    {
        $store = new ImageUploadStore($this->tmp . '/doctor', false);
        $first = $store->save($this->upload($this->png(300, 300)));
        $second = $store->save($this->upload($this->png(320, 320)));
        self::assertFileDoesNotExist($this->tmp . '/doctor/' . $first['name']);
        self::assertFileExists($this->tmp . '/doctor/' . $second['name']);
        $store->clear();
        self::assertNull($store->current());
    }

    public static function disguisedUploads(): array
    {
        return [
            'php with png name' => ['<?php system($_GET["c"]);', 'shell.png'],
            'text with jpg name' => ['hello world', 'photo.jpg'],
            'html with png name' => ['<html><script>alert(1)</script></html>', 'x.png'],
            'svg' => ['<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><script>alert(1)</script></svg>', 'x.svg'],
            'pdf' => ["%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF", 'x.png'],
        ];
    }

    #[DataProvider('disguisedUploads')]
    public function testImageStoreRejectsWrongRealMimeWhateverTheExtension(string $content, string $name): void
    {
        $store = new ImageUploadStore($this->tmp . '/doctor', false);
        $this->expectException(ValidationException::class);
        try {
            $store->save($this->upload($content, $name));
        } finally {
            self::assertNull($store->current());
        }
    }

    public function testImageStoreRejectsTinyOversizeAndFailedUploads(): void
    {
        $store = new ImageUploadStore($this->tmp . '/doctor', false);
        try {
            $store->save($this->upload($this->png(20, 20)));
            self::fail('Expected a validation error');
        } catch (ValidationException) {
            $this->addToAssertionCount(1);
        }
        try {
            $store->save($this->upload(str_repeat('a', ImageUploadStore::MAX_BYTES + 1)));
            self::fail('Expected a size error');
        } catch (PayloadTooLargeException) {
            $this->addToAssertionCount(1);
        }
        try {
            $store->save($this->upload('', 'x.png', UPLOAD_ERR_NO_FILE));
            self::fail('Expected a validation error');
        } catch (ValidationException) {
            $this->addToAssertionCount(1);
        }
        try {
            $store->save(null);
            self::fail('Expected a validation error');
        } catch (ValidationException) {
            $this->addToAssertionCount(1);
        }
    }
}
