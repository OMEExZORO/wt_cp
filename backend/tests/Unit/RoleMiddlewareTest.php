<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\AuthenticationException;
use App\Exceptions\AuthorizationException;
use App\Middleware\RequireAuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Middleware\VerifiedEmailMiddleware;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryAuditLogger;

final class RoleMiddlewareTest extends TestCase
{
    private InMemoryAuditLogger $audit;
    private RoleMiddleware $middleware;

    protected function setUp(): void
    {
        $this->audit = new InMemoryAuditLogger();
        $this->middleware = new RoleMiddleware($this->audit);
    }

    private function request(?string $role, bool $verified = true): Request
    {
        $request = new Request('GET', '/api/v1/dashboards/admin');
        if ($role !== null) {
            $request->setUser(['id' => 'u-1', 'role' => $role, 'email_verified_at' => $verified ? '2026-01-01' : null]);
        }
        return $request;
    }

    private function next(): callable
    {
        return static fn (Request $r): Response => Response::json(['ok' => true]);
    }

    public static function matrix(): array
    {
        $roles = ['patient', 'receptionist', 'doctor', 'admin', 'referrer'];
        $cases = [];
        foreach ($roles as $userRole) {
            foreach ($roles as $required) {
                $cases[$userRole . ' on ' . $required] = [$userRole, [$required], $userRole === $required];
            }
        }
        $cases['doctor on doctor,admin'] = ['doctor', ['doctor', 'admin'], true];
        $cases['admin on doctor,admin'] = ['admin', ['doctor', 'admin'], true];
        $cases['patient on doctor,admin'] = ['patient', ['doctor', 'admin'], false];
        return $cases;
    }

    #[DataProvider('matrix')]
    public function testRoleMatrix(string $userRole, array $required, bool $allowed): void
    {
        if (!$allowed) {
            $this->expectException(AuthorizationException::class);
        }
        $response = $this->middleware->handle($this->request($userRole), $this->next(), ...$required);
        self::assertSame(200, $response->status());
    }

    public function testForbiddenAttemptIsAudited(): void
    {
        try {
            $this->middleware->handle($this->request('patient'), $this->next(), 'admin');
            self::fail('Expected AuthorizationException');
        } catch (AuthorizationException $e) {
            self::assertSame(403, $e->status());
            self::assertSame('FORBIDDEN', $e->errorCode());
        }
        self::assertSame(['security.forbidden'], $this->audit->actions());
        self::assertSame(['admin'], $this->audit->entries[0]['options']['metadata']['required_roles']);
    }

    public function testGuestGetsAuthenticationError(): void
    {
        $this->expectException(AuthenticationException::class);
        $this->middleware->handle($this->request(null), $this->next(), 'patient');
    }

    public function testUnknownRoleIsAProgrammingError(): void
    {
        $this->expectException(\LogicException::class);
        $this->middleware->handle($this->request('admin'), $this->next(), 'superuser');
    }

    public function testRequireAuthBlocksGuestsAndAllowsUsers(): void
    {
        $auth = new RequireAuthMiddleware();
        self::assertSame(200, $auth->handle($this->request('patient'), $this->next())->status());
        $this->expectException(AuthenticationException::class);
        $auth->handle($this->request(null), $this->next());
    }

    public function testVerifiedEmailMiddleware(): void
    {
        $verified = new VerifiedEmailMiddleware();
        self::assertSame(200, $verified->handle($this->request('patient', true), $this->next())->status());
        $this->expectException(AuthorizationException::class);
        $verified->handle($this->request('patient', false), $this->next());
    }
}
