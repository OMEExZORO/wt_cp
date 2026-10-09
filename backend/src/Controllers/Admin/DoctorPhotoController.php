<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\NotFoundException;
use App\Models\AdminRepository;
use App\Services\Admin\ImageUploadStore;
use App\Services\AuditLogger;

final class DoctorPhotoController extends AdminController
{
    public const SETTING_KEY = 'doctor.photo_url';

    public function __construct(AuditLogger $audit, private readonly Config $config, private readonly AdminRepository $repository)
    {
        parent::__construct($audit);
    }

    public function show(Request $request): Response
    {
        $current = $this->imageStore()->current();
        if ($current === null) {
            throw new NotFoundException('No doctor photo has been uploaded.');
        }
        $body = (string) file_get_contents($current['path']);
        return (new Response($body, 200, ['Content-Type' => $current['mime']]))
            ->setHeader('Cache-Control', 'public, max-age=86400')
            ->setHeader('Content-Length', (string) strlen($body))
            ->setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    public function upload(Request $request): Response
    {
        $stored = $this->imageStore()->save($request->files()['photo'] ?? null, 'photo');
        $url = rtrim((string) $this->config->get('url'), '/') . '/api/v1/public/doctor/photo?v=' . time();
        $actor = $this->user($request);
        $this->repository->writeSetting(self::SETTING_KEY, $url, false, (string) $actor['id']);
        $this->record($request, 'admin.doctor_photo_uploaded', 'site_settings', self::SETTING_KEY, ['mime' => $stored['mime'], 'bytes' => $stored['bytes']]);
        return $this->ok(['photo_url' => $url]);
    }

    public function destroy(Request $request): Response
    {
        $this->imageStore()->clear();
        $actor = $this->user($request);
        $this->repository->writeSetting(self::SETTING_KEY, null, true, (string) $actor['id']);
        $this->record($request, 'admin.doctor_photo_removed', 'site_settings', self::SETTING_KEY);
        return $this->noContent();
    }

    private function imageStore(): ImageUploadStore
    {
        return new ImageUploadStore((string) $this->config->get('storage_path') . '/uploads/doctor');
    }
}
