<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Core\Config;
use App\Core\Container;
use App\Services\EncryptionService;
use PDO;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakePdo;

final class ContainerWiringTest extends TestCase
{
    private static ?Container $container = null;
    private static array $previousEnv = [];

    public static function setUpBeforeClass(): void
    {
        foreach (['ENCRYPTION_KEY' => EncryptionService::generateKey(), 'CSRF_SECRET' => str_repeat('c', 40), 'APP_KEY' => str_repeat('k', 40), 'MAIL_DRIVER' => 'log'] as $key => $value) {
            self::$previousEnv[$key] = $_ENV[$key] ?? null;
            $_ENV[$key] = $value;
            putenv($key . '=' . $value);
        }
        $backend = dirname(__DIR__, 2);
        $config = Config::fromFile($backend . '/config/app.php');
        self::$container = (require $backend . '/config/container.php')($config);
        self::$container->instance(PDO::class, new FakePdo());
    }

    public static function tearDownAfterClass(): void
    {
        foreach (self::$previousEnv as $key => $value) {
            if ($value === null) {
                unset($_ENV[$key]);
                putenv($key);
            } else {
                $_ENV[$key] = $value;
                putenv($key . '=' . $value);
            }
        }
    }

    public static function classes(): iterable
    {
        $src = dirname(__DIR__, 2) . '/src';
        foreach (['Controllers', 'Middleware'] as $folder) {
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($src . '/' . $folder, \FilesystemIterator::SKIP_DOTS));
            foreach ($iterator as $file) {
                if (!$file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }
                $relative = substr($file->getPathname(), strlen($src) + 1, -4);
                $class = 'App\\' . str_replace('/', '\\', str_replace('\\', '/', $relative));
                $reflection = new \ReflectionClass($class);
                if ($reflection->isInstantiable()) {
                    yield $class => [$class];
                }
            }
        }
        yield 'AlertService' => [\App\Services\Alerts\AlertService::class];
        yield 'NoteProtector' => [\App\Services\Alerts\NoteProtector::class];
        yield 'StorageService' => [\App\Services\Storage\StorageService::class];
        yield 'MailService' => [\App\Services\Mail\MailService::class];
    }

    #[DataProvider('classes')]
    public function testEveryControllerMiddlewareAndKeyServiceResolves(string $class): void
    {
        self::assertInstanceOf($class, self::$container->get($class));
    }
}
