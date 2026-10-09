<?php

declare(strict_types=1);

namespace Tests\Support;

use PDO;
use PDOStatement;

final class FakeStatement extends PDOStatement
{
    private array $rows = [];

    public function __construct(private readonly FakePdo $pdo, private readonly string $sql)
    {
    }

    public function bindValue(int|string $param, mixed $value, int $type = PDO::PARAM_STR): bool
    {
        return true;
    }

    public function execute(?array $params = null): bool
    {
        $this->pdo->statements[] = $this->sql;
        $this->rows = $this->pdo->rowsFor($this->sql);
        return true;
    }

    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed
    {
        return array_shift($this->rows) ?? false;
    }

    public function fetchAll(int $mode = PDO::FETCH_DEFAULT, mixed ...$args): array
    {
        $rows = $this->rows;
        $this->rows = [];
        return $rows;
    }

    public function fetchColumn(int $column = 0): mixed
    {
        $row = array_shift($this->rows);
        return $row === null ? false : array_values($row)[$column] ?? false;
    }

    public function rowCount(): int
    {
        return 0;
    }
}
