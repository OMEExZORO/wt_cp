<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\ScanType;
use App\Services\PublicContentPresenter;
use PHPUnit\Framework\TestCase;

final class PublicContentPresenterTest extends TestCase
{
    public function testPlaceholderSettingsHaveNullValueAndFlag(): void
    {
        $settings = PublicContentPresenter::settings([
            ['key' => 'contact.phone', 'value' => '9999999999', 'value_type' => 'phone', 'group_name' => 'contact', 'label' => 'Phone', 'is_placeholder' => true],
            ['key' => 'contact.email', 'value' => null, 'value_type' => 'email', 'group_name' => 'contact', 'label' => 'Email', 'is_placeholder' => 't'],
        ]);
        self::assertNull($settings['contact.phone']['value']);
        self::assertTrue($settings['contact.phone']['is_placeholder']);
        self::assertNull($settings['contact.email']['value']);
    }

    public function testJsonSettingsAreDecoded(): void
    {
        $settings = PublicContentPresenter::settings([
            ['key' => 'clinic.trust_pillars', 'value' => '["A","B"]', 'value_type' => 'json', 'group_name' => 'clinic', 'label' => 'Pillars', 'is_placeholder' => false],
        ]);
        self::assertSame(['A', 'B'], $settings['clinic.trust_pillars']['value']);
        self::assertFalse($settings['clinic.trust_pillars']['is_placeholder']);
    }

    public function testDoctorProfileCollectsDoctorKeysOnly(): void
    {
        $settings = PublicContentPresenter::settings([
            ['key' => 'doctor.name', 'value' => 'Dr X', 'value_type' => 'string', 'group_name' => 'doctor', 'label' => 'Name', 'is_placeholder' => false],
            ['key' => 'clinic.name', 'value' => 'MDC', 'value_type' => 'string', 'group_name' => 'clinic', 'label' => 'Clinic', 'is_placeholder' => false],
        ]);
        $doctor = PublicContentPresenter::doctor($settings);
        self::assertSame(['name'], array_keys($doctor));
    }

    public function testReviewSummaryWithNoReviewsHasNoAverage(): void
    {
        $summary = PublicContentPresenter::reviewSummary(['review_count' => '0', 'average_rating' => null]);
        self::assertSame(0, $summary['count']);
        self::assertNull($summary['average_rating']);
    }

    public function testReviewSummaryRoundsAverage(): void
    {
        $summary = PublicContentPresenter::reviewSummary(['review_count' => '3', 'average_rating' => '4.3333333']);
        self::assertSame(3, $summary['count']);
        self::assertSame(4.3, $summary['average_rating']);
    }

    public function testDemoFlagHiddenUnlessRequested(): void
    {
        $row = ['id' => 'x', 'display_name' => 'A', 'rating' => '5', 'body' => 'text', 'verified_visit' => 'f', 'is_demo' => 't', 'created_at' => '2026-10-08 10:00:00+05:30'];
        self::assertArrayNotHasKey('is_demo', PublicContentPresenter::review($row, false));
        self::assertTrue(PublicContentPresenter::review($row, true)['is_demo']);
    }

    public function testBranchPlaceholderAddressDetected(): void
    {
        $row = [
            'id' => '1', 'slug' => 'branch-2', 'name' => 'B', 'address_line' => 'TODO: add real value', 'landmark' => null, 'area' => null,
            'city' => 'Pune', 'state' => 'Maharashtra', 'postal_code' => null, 'phone' => '', 'whatsapp' => null, 'email' => null,
            'opening_hours' => null, 'maps_url' => null, 'maps_embed_url' => null, 'latitude' => null, 'longitude' => null, 'is_placeholder' => 't',
        ];
        $branch = PublicContentPresenter::branch($row);
        self::assertTrue($branch['address_is_placeholder']);
        self::assertNull($branch['phone']);
    }

    public function testLikeEscapingNeutralisesWildcards(): void
    {
        self::assertSame('100\\%\\_a\\\\b', ScanType::escapeLike('100%_a\\b'));
    }
}
