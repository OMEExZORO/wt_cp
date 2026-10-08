<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\AuthenticationException;
use App\Exceptions\AuthorizationException;
use App\Models\User;
use App\Services\AuditLogger;

final class RoleMiddleware implements Middleware
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function handle(Request $request, callable $next, string ...$params): Response
    {
        if ($params === []) {
            throw new \LogicException('Role middleware needs at least one role');
        }
        foreach ($params as $role) {
            if (!in_array($role, User::ROLES, true)) {
                throw new \LogicException(sprintf('Unknown role %s', $role));
            }
        }
        $user = $request->user();
        if ($user === null) {
            throw new AuthenticationException();
        }
        if (!in_array($user['role'] ?? null, $params, true)) {
            $this->audit->log('security.forbidden', $request, [
                'metadata' => ['required_roles' => $params],
            ]);
            throw new AuthorizationException();
        }
        return $next($request);
    }
}
