<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;

final class HealthController extends Controller
{
    public function show(Request $request): Response
    {
        return $this->ok(['status' => 'ok', 'service' => 'diagnocare-api']);
    }
}
