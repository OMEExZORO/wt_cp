<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;

final class DashboardController extends Controller
{
    private const AREAS = [
        'patient' => 'Patient dashboard',
        'doctor' => 'Doctor dashboard',
        'receptionist' => 'Reception dashboard',
        'admin' => 'Admin dashboard',
        'referrer' => 'Referrer dashboard',
    ];

    public function show(Request $request): Response
    {
        $user = $this->user($request);
        $area = basename($request->path());
        return $this->ok([
            'area' => $area,
            'title' => self::AREAS[$area] ?? 'Dashboard',
            'role' => $user['role'],
            'widgets' => [],
        ]);
    }
}
