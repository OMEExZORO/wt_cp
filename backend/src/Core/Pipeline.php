<?php

declare(strict_types=1);

namespace App\Core;

final class Pipeline
{
    public function __construct(private readonly MiddlewareResolver $resolver)
    {
    }

    public function run(Request $request, array $middleware, callable $destination): Response
    {
        $next = $destination;
        foreach (array_reverse($middleware) as $spec) {
            [$instance, $params] = $this->resolver->resolve($spec);
            $inner = $next;
            $next = static fn (Request $req): Response => $instance->handle($req, $inner, ...$params);
        }
        return $next($request);
    }
}
