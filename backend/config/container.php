<?php

declare(strict_types=1);

use App\Core\Config;
use App\Core\Container;
use App\Core\Database;
use App\Core\Env;
use App\Core\ErrorHandler;
use App\Core\Kernel;
use App\Core\Logger;
use App\Core\MiddlewareResolver;
use App\Core\Router;
use App\Middleware\AuthenticateMiddleware;
use App\Middleware\CorsMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Middleware\HandleErrorsMiddleware;
use App\Middleware\MatchRouteMiddleware;
use App\Middleware\RateLimitMiddleware;
use App\Middleware\RequireAuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Middleware\SecurityHeadersMiddleware;
use App\Middleware\StartSessionMiddleware;
use App\Middleware\VerifiedEmailMiddleware;
use App\Services\AuditLogger;
use App\Services\DatabaseAuditLogger;
use App\Services\Mail\LogMailer;
use App\Services\Mail\Mailer;
use App\Services\Mail\MailService;
use App\Services\Mail\SmtpMailer;
use App\Validation\RequestValidator;
use App\Validation\Sanitizer;

return static function (Config $config): Container {
    $container = new Container();
    $container->instance(Container::class, $container);
    $container->instance(Config::class, $config);

    $container->bind(PDO::class, static fn (): PDO => Database::connection());
    $container->bind(Logger::class, static fn (): Logger => new Logger((string) $config->get('log_path')));
    $container->bind(ErrorHandler::class, static fn (Container $c): ErrorHandler => new ErrorHandler((bool) $config->get('debug'), $c->get(Logger::class)));
    $container->bind(AuditLogger::class, static fn (Container $c): AuditLogger => $c->get(DatabaseAuditLogger::class));
    $container->bind(RequestValidator::class, static fn (Container $c): RequestValidator => new RequestValidator(
        $c->get(AuditLogger::class),
        $c->get(Sanitizer::class),
        Env::bool('MAIL_CHECK_MX', false)
    ));

    $container->bind(Mailer::class, static function () use ($config): Mailer {
        $mail = (array) $config->get('mail');
        if ($mail['driver'] === 'smtp') {
            return new SmtpMailer($mail);
        }
        return new LogMailer((string) $mail['log_path'], (string) $mail['from']);
    });
    $container->bind(MailService::class, static fn (Container $c): MailService => new MailService(
        $c->get(Mailer::class),
        $c->get(Logger::class),
        (string) $config->get('mail.templates'),
        ['clinic_name' => (string) $config->get('mail.from_name'), 'frontend_url' => (string) $config->get('frontend_url')]
    ));

    $container->bind(MiddlewareResolver::class, static fn (Container $c): MiddlewareResolver => new MiddlewareResolver($c, [
        'auth' => RequireAuthMiddleware::class,
        'role' => RoleMiddleware::class,
        'verified' => VerifiedEmailMiddleware::class,
        'throttle' => RateLimitMiddleware::class,
    ]));

    $container->bind(Router::class, static function (): Router {
        $router = new Router();
        (require dirname(__DIR__) . '/routes/api.php')($router);
        return $router;
    });

    $container->bind(Kernel::class, static fn (Container $c): Kernel => new Kernel(
        $c,
        $c->get(Router::class),
        $c->get(ErrorHandler::class),
        [
            CorsMiddleware::class,
            SecurityHeadersMiddleware::class,
            HandleErrorsMiddleware::class,
            MatchRouteMiddleware::class,
            StartSessionMiddleware::class,
            AuthenticateMiddleware::class,
            CsrfMiddleware::class,
        ]
    ));

    return $container;
};
