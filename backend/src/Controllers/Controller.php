<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Exceptions\AuthenticationException;
use App\Validation\RequestValidator;

abstract class Controller
{
    private ?RequestValidator $requestValidator = null;

    public function setRequestValidator(RequestValidator $validator): void
    {
        $this->requestValidator = $validator;
    }

    protected function validate(Request $request, array $rules, array $messages = [], ?array $input = null): array
    {
        if ($this->requestValidator === null) {
            throw new \LogicException('Request validator not configured');
        }
        return $this->requestValidator->validate($request, $rules, $messages, $input);
    }

    protected function user(Request $request): array
    {
        $user = $request->user();
        if ($user === null) {
            throw new AuthenticationException();
        }
        return $user;
    }

    protected function ok(mixed $data, int $status = 200, array $meta = []): Response
    {
        return Response::json($data, $status, $meta);
    }

    protected function created(mixed $data): Response
    {
        return Response::json($data, 201);
    }

    protected function message(string $message, int $status = 200): Response
    {
        return Response::json(['message' => $message], $status);
    }

    protected function noContent(): Response
    {
        return Response::noContent();
    }
}
