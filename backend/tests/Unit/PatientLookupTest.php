<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Controllers\PatientController;
use App\Core\Request;
use App\Exceptions\ValidationException;
use App\Models\Patient;
use App\Validation\RequestValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Tests\Support\FakePdo;
use Tests\Support\InMemoryAuditLogger;

final class PatientLookupTest extends TestCase
{
    private FakePdo $pdo;
    private InMemoryAuditLogger $audit;
    private PatientController $controller;

    protected function setUp(): void
    {
        $this->pdo = new FakePdo();
        $this->audit = new InMemoryAuditLogger();
        $this->controller = new PatientController(new Patient($this->pdo), $this->audit);
        $this->controller->setRequestValidator(new RequestValidator($this->audit));
    }

    private function request(array $query): Request
    {
        $request = new Request('GET', '/api/v1/patients/lookup', $query, [], '');
        $request->setUser(['id' => '00000000-0000-4000-8000-000000000003', 'role' => 'receptionist']);
        return $request;
    }

    public function testReturnsMatchesAndAudits(): void
    {
        $this->pdo->on('FROM patients', [['id' => '7b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', 'full_name' => 'Asha Patil', 'phone' => '9876543210', 'email' => 'private@example.com']]);
        $response = $this->controller->lookup($this->request(['q' => '98765']));
        $payload = json_decode($response->body(), true);
        self::assertSame('Asha Patil', $payload['data']['patients'][0]['full_name']);
        self::assertArrayNotHasKey('email', $payload['data']['patients'][0]);
        self::assertContains('patient.lookup', $this->audit->actions());
        self::assertSame([], $this->pdo->writes());
    }

    public static function badQueries(): array
    {
        return [
            'too short' => [['q' => 'ab'], null],
            'missing' => [[], null],
            'oversized' => [['q' => str_repeat('a', 61)], null],
            'sql tautology' => [['q' => "' OR '1'='1"], 'security.sqli_attempt'],
            'script tag' => [['q' => '<script>alert(1)</script>'], 'security.xss_attempt'],
        ];
    }

    #[DataProvider('badQueries')]
    public function testRejectsBadQueries(array $query, ?string $auditAction): void
    {
        try {
            $this->controller->lookup($this->request($query));
            self::fail('Expected a validation error');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('q', $e->fields());
        }
        self::assertSame([], $this->pdo->statements);
        if ($auditAction !== null) {
            self::assertContains($auditAction, $this->audit->actions());
        }
    }
}
