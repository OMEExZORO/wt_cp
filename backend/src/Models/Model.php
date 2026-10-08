<?php

declare(strict_types=1);

namespace App\Models;

use PDO;
use PDOStatement;

abstract class Model
{
    protected const TABLE = '';
    protected const PRIMARY_KEY = 'id';
    protected const FILLABLE = [];

    public function __construct(protected readonly PDO $db)
    {
    }

    public static function flag(mixed $value): bool
    {
        return $value === true || $value === 1 || $value === 't' || $value === 'true' || $value === '1';
    }

    public static function iso(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        try {
            return (new \DateTimeImmutable((string) $value))->format(\DateTimeInterface::ATOM);
        } catch (\Exception) {
            return null;
        }
    }

    public function find(string $id): ?array
    {
        return $this->fetchOne(
            sprintf('SELECT * FROM %s WHERE %s = :id', $this->table(), static::PRIMARY_KEY),
            ['id' => $id]
        );
    }

    public function create(array $attributes): array
    {
        $data = $this->onlyFillable($attributes);
        if ($data === []) {
            throw new \InvalidArgumentException('No fillable attributes supplied');
        }
        $columns = array_keys($data);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s) RETURNING *',
            $this->table(),
            implode(', ', $columns),
            implode(', ', array_map(static fn (string $c): string => ':' . $c, $columns))
        );
        return $this->fetchOne($sql, $data) ?? [];
    }

    public function update(string $id, array $attributes): ?array
    {
        $data = $this->onlyFillable($attributes);
        if ($data === []) {
            return $this->find($id);
        }
        $assignments = implode(', ', array_map(static fn (string $c): string => sprintf('%s = :%s', $c, $c), array_keys($data)));
        $data['__pk'] = $id;
        return $this->fetchOne(
            sprintf('UPDATE %s SET %s WHERE %s = :__pk RETURNING *', $this->table(), $assignments, static::PRIMARY_KEY),
            $data
        );
    }

    public function delete(string $id): bool
    {
        return $this->execute(
            sprintf('DELETE FROM %s WHERE %s = :id', $this->table(), static::PRIMARY_KEY),
            ['id' => $id]
        ) > 0;
    }

    public function transaction(callable $callback): mixed
    {
        if ($this->db->inTransaction()) {
            return $callback($this->db);
        }
        $this->db->beginTransaction();
        try {
            $result = $callback($this->db);
            $this->db->commit();
            return $result;
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    protected function fetchOne(string $sql, array $params = []): ?array
    {
        $row = $this->run($sql, $params)->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    protected function fetchAll(string $sql, array $params = []): array
    {
        return $this->run($sql, $params)->fetchAll(PDO::FETCH_ASSOC);
    }

    protected function fetchValue(string $sql, array $params = []): mixed
    {
        $value = $this->run($sql, $params)->fetchColumn();
        return $value === false ? null : $value;
    }

    protected function execute(string $sql, array $params = []): int
    {
        return $this->run($sql, $params)->rowCount();
    }

    protected function run(string $sql, array $params): PDOStatement
    {
        $statement = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
            if (is_bool($value)) {
                $value = $value ? 't' : 'f';
            }
            $type = match (true) {
                is_int($value) => PDO::PARAM_INT,
                $value === null => PDO::PARAM_NULL,
                default => PDO::PARAM_STR,
            };
            $statement->bindValue(':' . $key, $value, $type);
        }
        $statement->execute();
        return $statement;
    }

    private function table(): string
    {
        $table = static::TABLE;
        if (preg_match('/^[a-z_]+$/', $table) !== 1) {
            throw new \LogicException(sprintf('Invalid table name on %s', static::class));
        }
        return $table;
    }

    private function onlyFillable(array $attributes): array
    {
        $data = [];
        foreach ($attributes as $column => $value) {
            if (in_array($column, static::FILLABLE, true) && preg_match('/^[a-z_]+$/', (string) $column) === 1) {
                $data[$column] = $value;
            }
        }
        return $data;
    }
}
