<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Models\Patient;
use App\Models\Referrer;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\AuthService;
use App\Services\RegistrationService;

final class AuthController extends Controller
{
    public const ACCOUNT_RULES = [
        'account_type' => 'required|in:patient,referrer',
        'full_name' => 'required|name|min:2|max:120',
        'email' => 'required|email|max:254',
        'phone' => 'required|phone',
        'password' => 'required|password|confirmed',
        'consent' => 'required|accepted',
    ];

    public const PATIENT_RULES = [
        'date_of_birth' => 'nullable|date|after:1900-01-01|before:today',
        'gender' => 'nullable|in:female,male,other,prefer_not_to_say',
        'city' => 'nullable|string|min:2|max:80',
    ];

    public const REFERRER_RULES = [
        'qualification' => 'required|string|min:2|max:120',
        'registration_number' => 'required|registration_number',
        'clinic_name' => 'required|string|min:2|max:160',
        'city' => 'required|string|min:2|max:80',
    ];

    public function __construct(
        private readonly AuthService $auth,
        private readonly RegistrationService $registration,
        private readonly Csrf $csrf,
        private readonly User $users,
        private readonly Patient $patients,
        private readonly Referrer $referrers,
        private readonly AuditLogger $audit
    ) {
    }

    public function csrf(Request $request): Response
    {
        return $this->ok(['csrf_token' => $this->csrf->token(), 'header' => Csrf::HEADER]);
    }

    public function register(Request $request): Response
    {
        $type = $this->validate($request, ['account_type' => self::ACCOUNT_RULES['account_type']])['account_type'];
        $rules = array_merge(self::ACCOUNT_RULES, $type === 'referrer' ? self::REFERRER_RULES : self::PATIENT_RULES);
        $data = $this->validate($request, $rules, [
            'consent.required' => 'Please give your consent to continue.',
            'consent.accepted' => 'Please give your consent to continue.',
        ]);
        $user = $this->registration->register($data, $request);
        $request->setUser($user);
        return $this->created(['user' => $this->auth->present($user)]);
    }

    public function login(Request $request): Response
    {
        $data = $this->validate($request, [
            'email' => 'required|email|max:254',
            'password' => 'required|raw|max:128',
            'remember' => 'nullable|boolean',
        ]);
        $user = $this->auth->login($data['email'], $data['password'], $data['remember'] === true, $request);
        return $this->ok(['user' => $this->auth->present($user)]);
    }

    public function logout(Request $request): Response
    {
        $this->auth->logout($request);
        return $this->message('You have been signed out.');
    }

    public function logoutEverywhere(Request $request): Response
    {
        $revoked = $this->auth->logoutEverywhere($request, $this->user($request));
        return $this->ok(['message' => 'You have been signed out on all devices.', 'revoked_tokens' => $revoked]);
    }

    public function me(Request $request): Response
    {
        return $this->ok(['user' => $this->auth->present($this->user($request))]);
    }

    public function updateMe(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, [
            'full_name' => 'sometimes|required|name|min:2|max:120',
            'phone' => 'sometimes|required|phone',
        ]);
        if ($data !== []) {
            $updated = $this->users->update((string) $user['id'], $data) ?? $user;
            if ($user['role'] === 'patient') {
                $this->patients->syncContact((string) $user['id'], (string) $updated['full_name'], $updated['phone']);
            } elseif ($user['role'] === 'referrer') {
                $this->referrers->syncContact((string) $user['id'], (string) $updated['full_name'], $updated['phone']);
            }
            $this->audit->log('user.profile_updated', $request, [
                'entity_type' => 'user',
                'entity_id' => $user['id'],
                'metadata' => ['fields' => array_keys($data)],
            ]);
            $user = $updated;
        }
        return $this->ok(['user' => $this->auth->present($user)]);
    }
}
