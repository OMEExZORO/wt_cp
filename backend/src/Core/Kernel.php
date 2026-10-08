<?php

declare(strict_types=1);

namespace App\Core;

use App\Controllers\Controller;
use App\Validation\RequestValidator;
use Closure;
use Throwable;

final class Kernel
{
    public function __construct(
        private readonly Container $container,
        private readonly Router $router,
        private readonly ErrorHandler $errors,
        private readonly array $globalMiddleware = []
    ) {
    }

    public function handle(Request $request): Response
    {
        $pipeline = $this->container->get(Pipeline::class);
        try {
            return $pipeline->run(
                $request,
                $this->globalMiddleware,
                fn (Request $r): Response => $this->dispatch($r, $pipeline)
            );
        } catch (Throwable $e) {
            return $this->errors->render($e);
        }
    }

    private function dispatch(Request $request, Pipeline $pipeline): Response
    {
        $route = $request->attribute('route');
        if (!$route instanceof Route) {
            [$route, $params] = $this->router->match($request->method(), $request->path());
            $request->setAttribute('route_params', $params);
            $request->setAttribute('route', $route);
        }
        return $pipeline->run(
            $request,
            $route->middleware,
            fn (Request $r): Response => $this->invoke($route->handler, $r)
        );
    }

    private function invoke(mixed $handler, Request $request): Response
    {
        if ($handler instanceof Closure) {
            $result = $handler($request);
        } elseif (is_array($handler) && count($handler) === 2 && is_string($handler[0]) && is_string($handler[1])) {
            $controller = $this->container->get($handler[0]);
            if ($controller instanceof Controller) {
                $controller->setRequestValidator($this->container->get(RequestValidator::class));
            }
            $result = $controller->{$handler[1]}($request);
        } else {
            throw new \LogicException('Invalid route handler');
        }
        if (!$result instanceof Response) {
            throw new \LogicException('Route handlers must return a Response');
        }
        return $result;
    }
}
