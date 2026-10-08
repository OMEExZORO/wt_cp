<?php

declare(strict_types=1);

namespace App\Core;

use ReflectionClass;
use ReflectionNamedType;

final class Container
{
    private array $bindings = [];
    private array $instances = [];

    public function bind(string $id, callable $factory): void
    {
        $this->bindings[$id] = $factory;
        unset($this->instances[$id]);
    }

    public function instance(string $id, object $instance): void
    {
        $this->instances[$id] = $instance;
    }

    public function get(string $id): object
    {
        if (isset($this->instances[$id])) {
            return $this->instances[$id];
        }
        if (isset($this->bindings[$id])) {
            return $this->instances[$id] = ($this->bindings[$id])($this);
        }
        return $this->instances[$id] = $this->build($id);
    }

    private function build(string $class): object
    {
        if (!class_exists($class)) {
            throw new \RuntimeException(sprintf('Cannot resolve %s', $class));
        }
        $reflection = new ReflectionClass($class);
        if (!$reflection->isInstantiable()) {
            throw new \RuntimeException(sprintf('%s is not instantiable and has no binding', $class));
        }
        $constructor = $reflection->getConstructor();
        if ($constructor === null) {
            return new $class();
        }
        $args = [];
        foreach ($constructor->getParameters() as $parameter) {
            $type = $parameter->getType();
            if ($type instanceof ReflectionNamedType && !$type->isBuiltin()) {
                $args[] = $this->get($type->getName());
                continue;
            }
            if ($parameter->isDefaultValueAvailable()) {
                $args[] = $parameter->getDefaultValue();
                continue;
            }
            throw new \RuntimeException(sprintf('Cannot resolve parameter $%s of %s', $parameter->getName(), $class));
        }
        return $reflection->newInstanceArgs($args);
    }
}
