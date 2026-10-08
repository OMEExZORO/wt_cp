<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Container;
use App\Core\ErrorHandler;
use App\Core\Kernel;
use App\Core\MiddlewareResolver;
use App\Core\Pipeline;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Exceptions\MethodNotAllowedException;
use App\Exceptions\NotFoundException;
use App\Exceptions\ValidationException;
use PHPUnit\Framework\TestCase;
use Tests\Support\TraceMiddleware;

final class RouterTest extends TestCase
{
    public function testMatchesMethodAndPath(): void
    {
        $router = new Router();
        $router->get('/api/v1/health', 'health');
        $router->post('/api/v1/auth/login', 'login');
        [$route, $params] = $router->match('POST', '/api/v1/auth/login');
        self::assertSame('login', $route->handler);
        self::assertSame([], $params);
    }

    public function testExtractsRouteParameters(): void
    {
        $router = new Router();
        $router->get('/api/v1/branches/{slug:slug}/slots/{date}', 'slots');
        [, $params] = $router->match('GET', '/api/v1/branches/branch-1/slots/2026-10-09');
        self::assertSame(['slug' => 'branch-1', 'date' => '2026-10-09'], $params);
    }

    public function testTypedUuidParameterRejectsOtherValues(): void
    {
        $router = new Router();
        $router->get('/api/v1/appointments/{id:uuid}', 'show');
        [, $params] = $router->match('GET', '/api/v1/appointments/c4cccc6d-1c59-45ba-b4ef-730f48ff8760');
        self::assertSame('c4cccc6d-1c59-45ba-b4ef-730f48ff8760', $params['id']);
        $this->expectException(NotFoundException::class);
        $router->match('GET', '/api/v1/appointments/1%20OR%201=1');
    }

    public function testUnknownPathThrowsNotFound(): void
    {
        $router = new Router();
        $router->get('/api/v1/health', 'health');
        $this->expectException(NotFoundException::class);
        $router->match('GET', '/api/v1/missing');
    }

    public function testWrongMethodThrowsMethodNotAllowedWithAllowList(): void
    {
        $router = new Router();
        $router->get('/api/v1/auth/me', 'me');
        $router->patch('/api/v1/auth/me', 'update');
        try {
            $router->match('DELETE', '/api/v1/auth/me');
            self::fail('Expected MethodNotAllowedException');
        } catch (MethodNotAllowedException $e) {
            self::assertSame(['GET', 'PATCH'], $e->allowed());
            self::assertSame(405, $e->status());
        }
    }

    public function testHeadFallsBackToGet(): void
    {
        $router = new Router();
        $router->get('/api/v1/health', 'health');
        [$route] = $router->match('HEAD', '/api/v1/health');
        self::assertSame('health', $route->handler);
    }

    public function testSupportsAllRestVerbs(): void
    {
        $router = new Router();
        $router->get('/r', 'get');
        $router->post('/r', 'post');
        $router->put('/r', 'put');
        $router->patch('/r', 'patch');
        $router->delete('/r', 'delete');
        foreach (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
            [$route] = $router->match($method, '/r');
            self::assertSame(strtolower($method), $route->handler);
        }
    }

    public function testGroupsPrefixPathsAndMergeMiddleware(): void
    {
        $router = new Router();
        $router->group('/api/v1', ['outer'], static function (Router $r): void {
            $r->group('/admin', ['auth', 'role:admin'], static function (Router $r): void {
                $r->get('/users', 'users', ['throttle:admin,60,1']);
            });
        });
        [$route] = $router->match('GET', '/api/v1/admin/users');
        self::assertSame('/api/v1/admin/users', $route->pattern);
        self::assertSame(['outer', 'auth', 'role:admin', 'throttle:admin,60,1'], $route->middleware);
    }

    public function testPipelineRunsMiddlewareInOrderWithParameters(): void
    {
        TraceMiddleware::$log = [];
        $pipeline = new Pipeline(new MiddlewareResolver(new Container(), ['trace' => TraceMiddleware::class]));
        $response = $pipeline->run(
            new Request('GET', '/'),
            ['trace:outer', 'trace:inner,x'],
            static function (): Response {
                TraceMiddleware::$log[] = 'handler';
                return Response::json('done');
            }
        );
        self::assertSame(200, $response->status());
        self::assertSame(['before:outer', 'before:inner,x', 'handler', 'after:inner,x', 'after:outer'], TraceMiddleware::$log);
    }

    public function testUnknownMiddlewareAliasFails(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        (new MiddlewareResolver(new Container()))->resolve('does-not-exist');
    }

    public function testKernelReturnsJsonEnvelopesForSuccessAndErrors(): void
    {
        $container = new Container();
        $router = new Router();
        $router->get('/api/v1/items/{id:int}', static fn (Request $r): Response => Response::json(['id' => (int) $r->param('id')]));
        $router->post('/api/v1/items', static fn (): Response => throw new ValidationException(['name' => 'This field is required.']));
        $container->instance(Router::class, $router);
        $container->instance(MiddlewareResolver::class, new MiddlewareResolver($container));
        $kernel = new Kernel($container, $router, new ErrorHandler(false));

        $ok = $kernel->handle(new Request('GET', '/api/v1/items/7'));
        self::assertSame(200, $ok->status());
        self::assertSame(['data' => ['id' => 7], 'error' => null], $ok->decoded());

        $missing = $kernel->handle(new Request('GET', '/api/v1/nothing'));
        self::assertSame(404, $missing->status());
        self::assertSame('NOT_FOUND', $missing->decoded()['error']['code']);

        $wrong = $kernel->handle(new Request('DELETE', '/api/v1/items/7'));
        self::assertSame(405, $wrong->status());
        self::assertSame('GET', $wrong->header('Allow'));

        $invalid = $kernel->handle(new Request('POST', '/api/v1/items'));
        self::assertSame(422, $invalid->status());
        self::assertSame(['name' => 'This field is required.'], $invalid->decoded()['error']['fields']);
    }

    public function testErrorHandlerHidesDetailsInProduction(): void
    {
        $production = (new ErrorHandler(false))->render(new \RuntimeException('SQLSTATE secret detail'));
        self::assertSame(500, $production->status());
        self::assertStringNotContainsString('secret', $production->body());
        self::assertArrayNotHasKey('debug', $production->decoded()['error']);

        $development = (new ErrorHandler(true))->render(new \RuntimeException('visible in dev'));
        self::assertSame('visible in dev', $development->decoded()['error']['debug']['message']);
        self::assertArrayNotHasKey('trace', $development->decoded()['error']['debug']);
    }
}
