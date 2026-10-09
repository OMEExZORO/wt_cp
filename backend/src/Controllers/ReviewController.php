<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\ConflictException;
use App\Models\Model;
use App\Models\Review;
use App\Models\ReviewRepository;
use App\Services\AuditLogger;
use App\Services\ReviewPolicy;
use PDOException;

final class ReviewController extends Controller
{
    public function __construct(
        private readonly Review $reviews,
        private readonly ReviewRepository $repository,
        private readonly AuditLogger $audit
    ) {
    }

    public function store(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, [
            'appointment_id' => 'required|uuid',
            'rating' => 'required|integer|min:1|max:5',
            'body' => 'required|text|min:10|max:1000',
            'display_name' => 'nullable|name|min:2|max:80',
            'consent' => 'required|accepted',
        ]);
        $appointment = $this->repository->appointmentForReview($data['appointment_id']);
        ReviewPolicy::assertEligible($appointment, (string) $user['id'], $this->repository->existsForAppointment($data['appointment_id']));

        try {
            $review = $this->reviews->create([
                'patient_id' => $appointment['patient_id'],
                'appointment_id' => $data['appointment_id'],
                'display_name' => $data['display_name'] ?? ReviewPolicy::defaultDisplayName((string) $user['full_name']),
                'rating' => $data['rating'],
                'body' => $data['body'],
                'status' => 'pending',
                'verified_visit' => true,
                'is_demo' => false,
            ]);
        } catch (PDOException $e) {
            if ((string) $e->getCode() === '23505') {
                throw new ConflictException('You have already reviewed this visit.');
            }
            throw $e;
        }
        $this->audit->log('review.submitted', $request, ['entity_type' => 'review', 'entity_id' => $review['id'], 'metadata' => ['rating' => $data['rating']]]);
        return $this->created($this->present($review));
    }

    public function mine(Request $request): Response
    {
        $userId = (string) $this->user($request)['id'];
        return $this->ok([
            'reviews' => array_map($this->present(...), $this->repository->forUser($userId)),
            'eligible_appointments' => array_map(static fn (array $row): array => [
                'id' => $row['id'],
                'reference_code' => $row['reference_code'],
                'slot_date' => $row['slot_date'],
                'scan_name' => $row['scan_name'],
                'branch_name' => $row['branch_name'],
            ], $this->repository->eligibleAppointments($userId)),
        ]);
    }

    private function present(array $row): array
    {
        return [
            'id' => $row['id'],
            'display_name' => $row['display_name'],
            'rating' => (int) $row['rating'],
            'body' => $row['body'],
            'status' => $row['status'],
            'verified_visit' => Model::flag($row['verified_visit']),
            'created_at' => Model::iso($row['created_at']),
        ];
    }
}
