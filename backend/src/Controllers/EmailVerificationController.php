<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\ConflictException;
use App\Services\AuthService;
use App\Services\EmailVerificationService;

final class EmailVerificationController extends Controller
{
    public function __construct(
        private readonly EmailVerificationService $verification,
        private readonly AuthService $auth
    ) {
    }

    public function verify(Request $request): Response
    {
        $data = $this->validate($request, ['token' => 'required|token']);
        $verified = $this->verification->verify($data['token'], $request);
        $current = $request->user();
        $sameUser = $current !== null && ($current['id'] ?? null) === ($verified['id'] ?? null);
        return $this->ok([
            'message' => 'Thank you. Your email address is verified.',
            'user' => $sameUser ? $this->auth->present($verified) : null,
        ]);
    }

    public function resend(Request $request): Response
    {
        $user = $this->user($request);
        if (!empty($user['email_verified_at'])) {
            throw new ConflictException('Your email address is already verified.');
        }
        $this->verification->send($user);
        return $this->message('We have sent a new verification link to your email address.');
    }
}
