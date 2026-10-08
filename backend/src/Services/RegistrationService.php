<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\Request;
use App\Exceptions\ConflictException;
use App\Models\Patient;
use App\Models\Referrer;
use App\Models\User;
use PDOException;

final class RegistrationService
{
    public function __construct(
        private readonly User $users,
        private readonly Patient $patients,
        private readonly Referrer $referrers,
        private readonly AuthService $auth,
        private readonly EmailVerificationService $verification,
        private readonly AuditLogger $audit,
        private readonly Config $config
    ) {
    }

    public function register(array $data, Request $request): array
    {
        if ($this->users->emailExists($data['email'])) {
            throw $this->duplicate();
        }
        $consentAt = date('Y-m-d H:i:sP');
        $consentVersion = (string) $this->config->get('auth.consent_version');
        $role = $data['account_type'];

        try {
            $user = $this->users->transaction(function () use ($data, $role, $consentAt, $consentVersion): array {
                $user = $this->users->create([
                    'email' => $data['email'],
                    'password_hash' => password_hash($data['password'], PASSWORD_ARGON2ID),
                    'role' => $role,
                    'full_name' => $data['full_name'],
                    'phone' => $data['phone'],
                    'password_changed_at' => $consentAt,
                    'consent_given_at' => $consentAt,
                    'consent_version' => $consentVersion,
                ]);
                if ($role === 'patient') {
                    $this->patients->create([
                        'user_id' => $user['id'],
                        'full_name' => $data['full_name'],
                        'date_of_birth' => $data['date_of_birth'] ?? null,
                        'gender' => $data['gender'] ?? null,
                        'phone' => $data['phone'],
                        'email' => $data['email'],
                        'city' => $data['city'] ?? null,
                        'consent_given_at' => $consentAt,
                        'consent_version' => $consentVersion,
                    ]);
                } else {
                    $this->referrers->create([
                        'user_id' => $user['id'],
                        'full_name' => $data['full_name'],
                        'qualification' => $data['qualification'],
                        'registration_number' => $data['registration_number'],
                        'clinic_name' => $data['clinic_name'],
                        'phone' => $data['phone'],
                        'city' => $data['city'],
                    ]);
                }
                return $user;
            });
        } catch (PDOException $e) {
            if ($e->getCode() === '23505') {
                throw $this->duplicate();
            }
            throw $e;
        }

        $this->audit->log('auth.registered', $request, [
            'actor' => $user,
            'entity_type' => 'user',
            'entity_id' => $user['id'],
            'metadata' => ['role' => $role, 'consent_version' => $consentVersion],
        ]);
        $this->verification->send($user);
        $this->auth->startSession($user);
        return $user;
    }

    private function duplicate(): ConflictException
    {
        return new ConflictException('An account with this email already exists.', [
            'email' => 'An account with this email already exists. Try signing in or resetting your password.',
        ]);
    }
}
