<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Controllers\ReviewController;
use App\Core\Request;
use App\Exceptions\ConflictException;
use App\Exceptions\NotFoundException;
use App\Exceptions\ValidationException;
use App\Models\Review;
use App\Models\ReviewRepository;
use App\Services\ReviewPolicy;
use App\Validation\RequestValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakePdo;
use Tests\Support\InMemoryAuditLogger;

final class ReviewPolicyTest extends TestCase
{
    private const USER = '00000000-0000-4000-8000-000000000004';
    private const OTHER = '00000000-0000-4000-8000-000000000099';
    private const APPOINTMENT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

    private function appointment(string $status = 'completed', string $owner = self::USER): array
    {
        return ['id' => self::APPOINTMENT, 'status' => $status, 'patient_id' => 'p-1', 'patient_user_id' => $owner];
    }

    public function testCompletedOwnVisitIsEligible(): void
    {
        ReviewPolicy::assertEligible($this->appointment(), self::USER, false);
        $this->addToAssertionCount(1);
    }

    public function testUnknownAppointmentIsNotFound(): void
    {
        $this->expectException(NotFoundException::class);
        ReviewPolicy::assertEligible(null, self::USER, false);
    }

    public function testAnotherPatientsAppointmentLooksLikeNotFound(): void
    {
        $this->expectException(NotFoundException::class);
        ReviewPolicy::assertEligible($this->appointment('completed', self::OTHER), self::USER, false);
    }

    public static function unfinishedStatuses(): array
    {
        return array_map(static fn (string $status): array => [$status], ['pending', 'confirmed', 'checked_in', 'in_progress', 'cancelled', 'no_show']);
    }

    #[DataProvider('unfinishedStatuses')]
    public function testOnlyCompletedVisitsCanBeReviewed(string $status): void
    {
        try {
            ReviewPolicy::assertEligible($this->appointment($status), self::USER, false);
            self::fail('Expected a validation error');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('appointment_id', $e->fields());
        }
    }

    public function testSecondReviewForSameVisitConflicts(): void
    {
        $this->expectException(ConflictException::class);
        ReviewPolicy::assertEligible($this->appointment(), self::USER, true);
    }

    public function testDefaultDisplayNameShowsFirstNameAndInitial(): void
    {
        self::assertSame('Asha K.', ReviewPolicy::defaultDisplayName('Asha Kulkarni'));
        self::assertSame('Asha P.', ReviewPolicy::defaultDisplayName('Asha Rao Patil'));
        self::assertSame('Asha', ReviewPolicy::defaultDisplayName('Asha'));
        self::assertSame('Patient', ReviewPolicy::defaultDisplayName('   '));
    }

    private function controller(FakePdo $pdo, InMemoryAuditLogger $audit): ReviewController
    {
        $controller = new ReviewController(new Review($pdo), new ReviewRepository($pdo), $audit);
        $controller->setRequestValidator(new RequestValidator($audit));
        return $controller;
    }

    private function request(array $body, string $userId = self::USER): Request
    {
        $request = new Request('POST', '/api/v1/reviews', [], ['content-type' => 'application/json'], (string) json_encode($body));
        $request->setUser(['id' => $userId, 'role' => 'patient', 'full_name' => 'Dev Patient']);
        return $request;
    }

    private function body(array $overrides = []): array
    {
        return array_merge(['appointment_id' => self::APPOINTMENT, 'rating' => 5, 'body' => 'Friendly staff and a quick scan.', 'consent' => true], $overrides);
    }

    public static function badReviews(): array
    {
        return [
            'rating zero' => [['rating' => 0], 'rating'],
            'rating six' => [['rating' => 6], 'rating'],
            'text too short' => [['body' => 'Nice'], 'body'],
            'script in text' => [['body' => '<script>alert(1)</script> padding'], 'body'],
            'sql in text' => [['body' => "'; DROP TABLE users;-- padding"], 'body'],
            'oversized text' => [['body' => str_repeat('a', 1001)], 'body'],
            'no consent' => [['consent' => false], 'consent'],
            'bad appointment id' => [['appointment_id' => 'abc'], 'appointment_id'],
            'markup in name' => [['display_name' => '<b>Eve</b>'], 'display_name'],
        ];
    }

    #[DataProvider('badReviews')]
    public function testInvalidReviewsWriteNothing(array $overrides, string $field): void
    {
        $pdo = new FakePdo();
        $audit = new InMemoryAuditLogger();
        try {
            $this->controller($pdo, $audit)->store($this->request($this->body($overrides)));
            self::fail('Expected a validation error');
        } catch (ValidationException $e) {
            self::assertArrayHasKey($field, $e->fields());
        }
        self::assertSame([], $pdo->writes());
    }

    public function testEligibleReviewIsStoredPendingAndVerified(): void
    {
        $pdo = new FakePdo();
        $pdo->on('FROM appointments a JOIN patients p', [$this->appointment()]);
        $pdo->on('SELECT EXISTS', [['exists' => false]]);
        $pdo->on('INSERT INTO reviews', [['id' => 'r-1', 'display_name' => 'Dev P.', 'rating' => 5, 'body' => 'Friendly staff and a quick scan.', 'status' => 'pending', 'verified_visit' => true, 'created_at' => '2026-10-09 10:00:00+05:30']]);
        $audit = new InMemoryAuditLogger();
        $response = $this->controller($pdo, $audit)->store($this->request($this->body()));
        self::assertSame(201, $response->status());
        self::assertSame('pending', $response->decoded()['data']['status']);
        self::assertContains('review.submitted', $audit->actions());
        self::assertCount(1, array_filter($pdo->writes(), static fn (string $sql): bool => str_contains($sql, 'INSERT INTO reviews')));
    }

    public function testReviewForUncompletedVisitWritesNothing(): void
    {
        $pdo = new FakePdo();
        $pdo->on('FROM appointments a JOIN patients p', [$this->appointment('confirmed')]);
        $pdo->on('SELECT EXISTS', [['exists' => false]]);
        $this->expectException(ValidationException::class);
        try {
            $this->controller($pdo, new InMemoryAuditLogger())->store($this->request($this->body()));
        } finally {
            self::assertSame([], $pdo->writes());
        }
    }
}
