<?php

declare(strict_types=1);

namespace App\Services\Admin;

use App\Exceptions\PayloadTooLargeException;
use App\Exceptions\ValidationException;

final class ImageUploadStore
{
    public const MAX_BYTES = 2097152;
    public const MIN_DIMENSION = 200;
    public const MAX_DIMENSION = 6000;
    public const MIME_EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function __construct(private readonly string $directory, private readonly bool $requireHttpUpload = true)
    {
    }

    public function save(?array $file, string $field = 'photo'): array
    {
        if ($file === null || !isset($file['tmp_name'], $file['error']) || is_array($file['tmp_name'])) {
            throw ValidationException::withField($field, 'Choose an image file to upload.');
        }
        $error = (int) $file['error'];
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            throw new PayloadTooLargeException('The image is larger than the 2 MB limit.');
        }
        if ($error !== UPLOAD_ERR_OK) {
            throw ValidationException::withField($field, 'The upload did not complete. Please try again.');
        }
        $tmp = (string) $file['tmp_name'];
        if ($this->requireHttpUpload && !is_uploaded_file($tmp)) {
            throw ValidationException::withField($field, 'Choose an image file to upload.');
        }
        $size = filesize($tmp);
        if ($size === false || $size < 1) {
            throw ValidationException::withField($field, 'The image is empty.');
        }
        if ($size > self::MAX_BYTES) {
            throw new PayloadTooLargeException('The image is larger than the 2 MB limit.');
        }

        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($tmp);
        if (!isset(self::MIME_EXTENSIONS[$mime])) {
            throw ValidationException::withField($field, 'Only JPEG, PNG or WebP images are accepted.');
        }
        $dimensions = @getimagesize($tmp);
        if ($dimensions === false || $dimensions[0] < self::MIN_DIMENSION || $dimensions[1] < self::MIN_DIMENSION
            || $dimensions[0] > self::MAX_DIMENSION || $dimensions[1] > self::MAX_DIMENSION) {
            throw ValidationException::withField($field, 'The image must be between 200 and 6000 pixels on each side.');
        }

        if (!is_dir($this->directory) && !mkdir($this->directory, 0750, true) && !is_dir($this->directory)) {
            throw new \RuntimeException('Upload directory is not writable');
        }
        $name = bin2hex(random_bytes(16)) . '.' . self::MIME_EXTENSIONS[$mime];
        $target = $this->directory . DIRECTORY_SEPARATOR . $name;
        $moved = $this->requireHttpUpload ? move_uploaded_file($tmp, $target) : copy($tmp, $target);
        if (!$moved) {
            throw new \RuntimeException('Could not store the uploaded image');
        }
        $this->removeExcept($name);
        return ['name' => $name, 'mime' => $mime, 'bytes' => (int) $size];
    }

    public function current(): ?array
    {
        $latest = null;
        foreach ($this->files() as $path) {
            if ($latest === null || filemtime($path) > filemtime($latest)) {
                $latest = $path;
            }
        }
        if ($latest === null) {
            return null;
        }
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($latest);
        return isset(self::MIME_EXTENSIONS[$mime]) ? ['path' => $latest, 'mime' => $mime] : null;
    }

    public function clear(): void
    {
        $this->removeExcept('');
    }

    private function files(): array
    {
        $found = glob($this->directory . DIRECTORY_SEPARATOR . '*.{jpg,png,webp}', GLOB_BRACE);
        return $found === false ? [] : $found;
    }

    private function removeExcept(string $keep): void
    {
        foreach ($this->files() as $path) {
            if (basename($path) !== $keep) {
                @unlink($path);
            }
        }
    }
}
