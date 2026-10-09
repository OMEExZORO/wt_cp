<?php

declare(strict_types=1);

namespace App\Services\Reports;

use App\Exceptions\PayloadTooLargeException;
use App\Exceptions\ValidationException;

final class UploadedFileValidator
{
    public const MAX_BYTES = 10485760;
    public const TYPES = [
        'application/pdf' => ['pdf'],
        'image/jpeg' => ['jpg', 'jpeg'],
        'image/png' => ['png'],
    ];
    private const DANGEROUS_SEGMENT = '/\.(php\d?|phtml|phar|pl|py|rb|cgi|asp|aspx|jsp|exe|dll|com|bat|cmd|sh|bash|ps1|vbs|js|mjs|html?|svg|swf|jar)(\.|$)/i';

    public function __construct(private readonly int $maxBytes = self::MAX_BYTES, private readonly bool $requireHttpUpload = true)
    {
    }

    public function validate(mixed $file): array
    {
        if (!is_array($file) || !isset($file['error']) || is_array($file['error'])) {
            throw ValidationException::withField('file', 'Choose a file to upload.');
        }
        $error = (int) $file['error'];
        if ($error === UPLOAD_ERR_NO_FILE) {
            throw ValidationException::withField('file', 'Choose a file to upload.');
        }
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            throw new PayloadTooLargeException($this->tooLargeMessage(), ['file' => $this->tooLargeMessage()]);
        }
        if ($error !== UPLOAD_ERR_OK) {
            throw ValidationException::withField('file', 'The upload did not complete. Please try again.');
        }

        $path = (string) ($file['tmp_name'] ?? '');
        if ($path === '' || !is_file($path) || ($this->requireHttpUpload && !is_uploaded_file($path))) {
            throw ValidationException::withField('file', 'The upload could not be read. Please try again.');
        }

        $size = (int) filesize($path);
        if ($size <= 0) {
            throw ValidationException::withField('file', 'The file is empty.');
        }
        if ($size > $this->maxBytes) {
            throw new PayloadTooLargeException($this->tooLargeMessage(), ['file' => $this->tooLargeMessage()]);
        }

        $originalName = self::cleanName((string) ($file['name'] ?? ''));
        if ($originalName === '' || preg_match(self::DANGEROUS_SEGMENT, $originalName) === 1) {
            throw ValidationException::withField('file', 'This file name is not allowed.');
        }
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($path);
        if (!is_string($mime) || !isset(self::TYPES[$mime])) {
            throw ValidationException::withField('file', 'Only PDF, JPG and PNG files are allowed.');
        }
        if (!in_array($extension, self::TYPES[$mime], true)) {
            throw ValidationException::withField('file', 'The file extension does not match the file contents.');
        }

        return [
            'tmp_name' => $path,
            'mime_type' => $mime,
            'extension' => $extension,
            'size_bytes' => $size,
            'original_name' => $originalName,
        ];
    }

    public static function cleanName(string $name): string
    {
        $name = str_replace('\\', '/', $name);
        $name = basename($name);
        $name = preg_replace('/[^A-Za-z0-9._ -]+/', '_', $name) ?? '';
        $name = trim(preg_replace('/\s+/', ' ', $name) ?? '', ' .');
        return mb_substr($name, 0, 100);
    }

    private function tooLargeMessage(): string
    {
        return sprintf('The file is too large. The limit is %d MB.', intdiv($this->maxBytes, 1048576));
    }
}
