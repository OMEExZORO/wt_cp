<?php

declare(strict_types=1);

use App\Core\Config;
use App\Core\ErrorHandler;
use App\Core\Kernel;
use App\Core\Request;

require dirname(__DIR__) . '/config/bootstrap.php';

$config = Config::fromFile(dirname(__DIR__) . '/config/app.php');
$container = (require dirname(__DIR__) . '/config/container.php')($config);

$container->get(ErrorHandler::class)->register();

$request = Request::fromGlobals((bool) $config->get('trust_proxy'));
$container->get(Kernel::class)->handle($request)->send();
