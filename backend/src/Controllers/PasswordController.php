<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\PasswordService;

final class PasswordController extends Controller
{
    public function __construct(private readonly PasswordService $passwords)
    {
    }

    public function forgot(Request $request): Response
    {
        $data = $this->validate($request, ['email' => 'required|email|max:254']);
        $this->passwords->requestReset($data['email'], $request);
        return $this->message('If an account exists for that email, we have sent a link to reset the password.');
    }

    public function reset(Request $request): Response
    {
        $data = $this->validate($request, [
            'token' => 'required|token',
            'password' => 'required|password|confirmed',
        ]);
        $this->passwords->reset($data['token'], $data['password'], $request);
        return $this->message('Your password has been reset. You can now sign in.');
    }

    public function change(Request $request): Response
    {
        $user = $this->user($request);
        $data = $this->validate($request, [
            'current_password' => 'required|raw|max:128',
            'password' => 'required|password|confirmed|different:current_password',
        ]);
        $this->passwords->change($user, $data['current_password'], $data['password'], $request);
        return $this->message('Your password has been changed. Other devices have been signed out.');
    }
}
