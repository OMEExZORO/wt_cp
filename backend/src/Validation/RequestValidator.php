<?php

declare(strict_types=1);

namespace App\Validation;

use App\Core\Request;
use App\Exceptions\ValidationException;
use App\Services\AuditLogger;

final class RequestValidator
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly Sanitizer $sanitizer = new Sanitizer(),
        private readonly bool $checkMx = false
    ) {
    }

    public function validate(Request $request, array $rules, array $messages = [], ?array $input = null): array
    {
        $source = $input ?? ($request->isMethodSafe() ? $request->query() : $request->body());
        $validator = new Validator($this->sanitizer, $this->checkMx);
        try {
            return $validator->validate($source, $rules, $messages);
        } catch (ValidationException $e) {
            foreach ($e->threats() as $threat) {
                $this->audit->log('security.' . $threat['type'] . '_attempt', $request, [
                    'metadata' => ['field' => $threat['field'], 'sample' => $threat['sample']],
                ]);
            }
            throw $e;
        }
    }
}
