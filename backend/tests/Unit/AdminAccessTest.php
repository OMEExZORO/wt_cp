<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Exceptions\AuthorizationException;
use App\Middleware\RoleMiddleware;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\InMemoryAuditLogger;

final class AdminAccessTest extends TestCase
{
    private static function router(): Router
    {
        $router = new Router();
        (require dirname(__DIR__, 2) . '/routes/api.php')($router);
        return $router;
    }

    public function testEveryAdminRouteRequiresLoginAndTheAdminRole(): void
    {
        $adminRoutes = array_filter(self::router()->routes(), static fn ($route): bool => str_starts_with($route->pattern, '/api/v1/admin'));
        self::assertGreaterThan(30, count($adminRoutes));
        foreach ($adminRoutes as $route) {
            self::assertContains('auth', $route->middleware, $route->method . ' ' . $route->pattern);
            self::assertContains('role:admin', $route->middleware, $route->method . ' ' . $route->pattern);
        }
    }

    public function testAdminRoutesUseTheRightVerbs(): void
    {
        $verbs = [];
        foreach (self::router()->routes() as $route) {
            if (str_starts_with($route->pattern, '/api/v1/admin')) {
                $verbs[$route->method] = true;
            }
        }
        self::assertSame(['DELETE', 'GET', 'PATCH', 'POST', 'PUT'], array_keys($this->sorted($verbs)));
    }

    public function testReviewSubmissionIsPatientOnly(): void
    {
        foreach (self::router()->routes() as $route) {
            if (str_starts_with($route->pattern, '/api/v1/reviews')) {
                self::assertContains('auth', $route->middleware);
                self::assertContains('role:patient', $route->middleware);
            }
        }
    }

    public static function nonAdminRoles(): array
    {
        return [['patient'], ['receptionist'], ['doctor'], ['referrer']];
    }

    #[DataProvider('nonAdminRoles')]
    public function testNonAdminRolesAreDeniedAndAudited(string $role): void
    {
        $audit = new InMemoryAuditLogger();
        $middleware = new RoleMiddleware($audit);
        $request = new Request('PATCH', '/api/v1/admin/settings');
        $request->setUser(['id' => 'u-1', 'role' => $role]);
        try {
            $middleware->handle($request, static fn (Request $r): Response => Response::json(['ok' => true]), 'admin');
            self::fail('Expected AuthorizationException');
        } catch (AuthorizationException $e) {
            self::assertSame(403, $e->status());
        }
        self::assertSame(['security.forbidden'], $audit->actions());
    }

    public function testAdminPasses(): void
    {
        $middleware = new RoleMiddleware(new InMemoryAuditLogger());
        $request = new Request('GET', '/api/v1/admin/stats');
        $request->setUser(['id' => 'u-1', 'role' => 'admin']);
        $response = $middleware->handle($request, static fn (Request $r): Response => Response::json(['ok' => true]), 'admin');
        self::assertSame(200, $response->status());
    }

    private function sorted(array $verbs): array
    {
        ksort($verbs);
        return $verbs;
    }
}
