<?php

declare(strict_types=1);

namespace DiagnoCare\Controllers;

use DiagnoCare\Core\Csrf;
use DiagnoCare\Core\Request;
use DiagnoCare\Core\Response;

final class MetaController
{
    public function health(Request $request): never
    {
        Response::ok(['status' => 'up', 'time' => date(DATE_ATOM)]);
    }

    public function csrf(Request $request): never
    {
        Response::ok(['csrf_token' => Csrf::token()]);
    }
}
