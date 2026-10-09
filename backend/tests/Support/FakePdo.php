<?php

declare(strict_types=1);

namespace Tests\Support;

use PDO;
use PDOStatement;

final class FakePdo extends PDO
{
    public array $statements = [];
    private array $fixtures = [];
    private bool $inTransaction = false;

    public function __construct()
    {
    }

    public function on(string $needle, array $rows): void
    {
        $this->fixtures[$needle] = $rows;
    }

    public function rowsFor(string $sql): array
    {
        foreach ($this->fixtures as $needle => $rows) {
            if (str_contains($sql, $needle)) {
                return $rows;
            }
        }
        return [];
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        return new FakeStatement($this, $query);
    }

    public function exec(string $statement): int|false
    {
        $this->statements[] = $statement;
        return 0;
    }

    public function beginTransaction(): bool
    {
        $this->statements[] = 'BEGIN';
        $this->inTransaction = true;
        return true;
    }

    public function commit(): bool
    {
        $this->statements[] = 'COMMIT';
        $this->inTransaction = false;
        return true;
    }

    public function rollBack(): bool
    {
        $this->statements[] = 'ROLLBACK';
        $this->inTransaction = false;
        return true;
    }

    public function inTransaction(): bool
    {
        return $this->inTransaction;
    }

    public function writes(): array
    {
        return array_values(array_filter(
            $this->statements,
            static fn (string $sql): bool => preg_match('/^\s*(INSERT|UPDATE|DELETE|BEGIN)\b/i', $sql) === 1
        ));
    }
}
