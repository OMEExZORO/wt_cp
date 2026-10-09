<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Exceptions\ConflictException;
use App\Services\Alerts\AlertWorkflow;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class AlertWorkflowTest extends TestCase
{
    private const PATIENT_USER = '00000000-0000-4000-8000-000000000001';
    private const REFERRER_USER = '00000000-0000-4000-8000-000000000005';
    private const OTHER_USER = '00000000-0000-4000-8000-000000000099';

    public static function allowed(): array
    {
        return [
            ['open', 'notified'],
            ['notified', 'escalated'],
            ['escalated', 'acknowledged'],
            ['notified', 'acknowledged'],
            ['escalated', 'resolved'],
            ['acknowledged', 'resolved'],
            ['open', 'cancelled'],
        ];
    }

    #[DataProvider('allowed')]
    public function testAllowedTransitions(string $from, string $to): void
    {
        $this->assertTrue(AlertWorkflow::canTransition($from, $to));
        AlertWorkflow::assertTransition($from, $to);
    }

    public static function refused(): array
    {
        return [
            ['acknowledged', 'acknowledged'],
            ['acknowledged', 'escalated'],
            ['resolved', 'acknowledged'],
            ['resolved', 'resolved'],
            ['cancelled', 'notified'],
            ['notified', 'open'],
            ['unknown', 'resolved'],
        ];
    }

    #[DataProvider('refused')]
    public function testRefusedTransitions(string $from, string $to): void
    {
        $this->assertFalse(AlertWorkflow::canTransition($from, $to));
        $this->expectException(ConflictException::class);
        AlertWorkflow::assertTransition($from, $to);
    }

    private function alert(): array
    {
        return ['patient_user_id' => self::PATIENT_USER, 'referrer_user_id' => self::REFERRER_USER];
    }

    public function testPatientOwnerMayAcknowledge(): void
    {
        $this->assertTrue(AlertWorkflow::mayAcknowledge(['id' => self::PATIENT_USER, 'role' => 'patient'], $this->alert()));
    }

    public function testLinkedReferrerMayAcknowledge(): void
    {
        $this->assertTrue(AlertWorkflow::mayAcknowledge(['id' => self::REFERRER_USER, 'role' => 'referrer'], $this->alert()));
    }

    public function testOtherPatientAndReferrerMayNot(): void
    {
        $this->assertFalse(AlertWorkflow::mayAcknowledge(['id' => self::OTHER_USER, 'role' => 'patient'], $this->alert()));
        $this->assertFalse(AlertWorkflow::mayAcknowledge(['id' => self::OTHER_USER, 'role' => 'referrer'], $this->alert()));
    }

    public function testRoleMismatchWithMatchingIdIsRefused(): void
    {
        $this->assertFalse(AlertWorkflow::mayAcknowledge(['id' => self::PATIENT_USER, 'role' => 'referrer'], $this->alert()));
        $this->assertFalse(AlertWorkflow::mayAcknowledge(['id' => self::REFERRER_USER, 'role' => 'patient'], $this->alert()));
    }

    public function testStaffMayNotAcknowledge(): void
    {
        foreach (['receptionist', 'doctor', 'admin'] as $role) {
            $this->assertFalse(AlertWorkflow::mayAcknowledge(['id' => self::PATIENT_USER, 'role' => $role], $this->alert()));
        }
    }

    public function testAlertWithoutReferrerCannotBeAcknowledgedByAnyReferrer(): void
    {
        $alert = ['patient_user_id' => self::PATIENT_USER, 'referrer_user_id' => null];
        $this->assertFalse(AlertWorkflow::mayAcknowledge(['id' => self::REFERRER_USER, 'role' => 'referrer'], $alert));
    }

    public function testRedFlagOnlyWhileUnresolved(): void
    {
        $this->assertTrue(AlertWorkflow::isRedFlagged(['status' => 'escalated', 'staff_flagged_at' => '2026-10-09T12:00:00+05:30']));
        $this->assertFalse(AlertWorkflow::isRedFlagged(['status' => 'resolved', 'staff_flagged_at' => '2026-10-09T12:00:00+05:30']));
        $this->assertFalse(AlertWorkflow::isRedFlagged(['status' => 'escalated', 'staff_flagged_at' => null]));
    }
}
