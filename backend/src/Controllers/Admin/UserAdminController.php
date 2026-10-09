<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Exceptions\ConflictException;
use App\Exceptions\ValidationException;
use App\Models\AdminRepository;
use App\Models\Model;
use App\Models\PasswordReset;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\Mail\MailService;
use App\Services\RememberMeService;

final class UserAdminController extends AdminController
{
    public const STAFF_ROLES = ['receptionist', 'doctor', 'admin'];

    public function __construct(
        AuditLogger $audit,
        private readonly Config $config,
        private readonly User $users,
        private readonly AdminRepository $repository,
        private readonly PasswordReset $resets,
        private readonly RememberMeService $remember,
        private readonly MailService $mail
    ) {
        parent::__construct($audit);
    }

    public function index(Request $request): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request);
        $filters = $this->validate($request, [
            'role' => 'nullable|in:' . implode(',', User::ROLES),
            'is_active' => 'nullable|boolean',
            'q' => 'nullable|string|max:80',
        ]);
        $filters = array_filter($filters, static fn (mixed $value): bool => $value !== null);
        $rows = array_map($this->present(...), $this->repository->users($filters, $perPage, $offset));
        return $this->paged($rows, $this->repository->userCount($filters), $page, $perPage);
    }

    public function store(Request $request): Response
    {
        $data = $this->validate($request, [
            'email' => 'required|email',
            'full_name' => 'required|name|min:2|max:120',
            'phone' => 'nullable|phone',
            'role' => 'required|in:' . implode(',', self::STAFF_ROLES),
            'password' => 'required|password',
        ]);
        if ($this->users->emailExists($data['email'])) {
            throw new ConflictException('An account with this email already exists.', ['email' => 'An account with this email already exists.']);
        }
        $now = date('Y-m-d H:i:sP');
        $user = $this->runWrite(fn (): array => $this->users->create([
            'email' => $data['email'],
            'password_hash' => password_hash($data['password'], PASSWORD_ARGON2ID),
            'role' => $data['role'],
            'full_name' => $data['full_name'],
            'phone' => $data['phone'] ?? null,
            'email_verified_at' => $now,
            'password_changed_at' => $now,
        ]), 'An account with this email already exists.');
        $this->record($request, 'admin.user_created', 'user', (string) $user['id'], ['role' => $data['role']]);
        return $this->created($this->present($this->repository->userById((string) $user['id']) ?? $user));
    }

    public function update(Request $request): Response
    {
        $id = $this->uuidParam($request);
        $actor = $this->user($request);
        $target = $this->requireFound($this->repository->userById($id), 'User');
        $data = $this->validate($request, [
            'full_name' => 'sometimes|required|name|min:2|max:120',
            'phone' => 'sometimes|nullable|phone',
            'role' => 'sometimes|required|in:' . implode(',', User::ROLES),
            'is_active' => 'sometimes|required|boolean',
        ]);

        $targetIsSelf = (string) $target['id'] === (string) $actor['id'];
        $isStaff = in_array($target['role'], self::STAFF_ROLES, true);

        if (isset($data['role']) && $data['role'] !== $target['role']) {
            if (!$isStaff || !in_array($data['role'], self::STAFF_ROLES, true)) {
                throw ValidationException::withField('role', 'Only staff accounts can change between receptionist, doctor and admin.');
            }
            if ($targetIsSelf) {
                throw ValidationException::withField('role', 'You cannot change your own role.');
            }
            $this->assertNotLastAdmin($target, 'role');
        }
        if (isset($data['is_active']) && $data['is_active'] === false && Model::flag($target['is_active'])) {
            if ($targetIsSelf) {
                throw ValidationException::withField('is_active', 'You cannot deactivate your own account.');
            }
            $this->assertNotLastAdmin($target, 'is_active');
        }

        $updated = $this->runWrite(fn (): ?array => $this->users->update($id, $data), 'This change conflicts with an existing record.');
        if (isset($data['is_active']) && $data['is_active'] === false) {
            $this->remember->revokeAll($id);
        }
        $this->record($request, 'admin.user_updated', 'user', $id, ['fields' => array_keys($data)]);
        return $this->ok($this->present($this->repository->userById($id) ?? $updated ?? $target));
    }

    public function passwordReset(Request $request): Response
    {
        $id = $this->uuidParam($request);
        $target = $this->requireFound($this->users->find($id), 'User');
        if (!Model::flag($target['is_active'])) {
            throw new ConflictException('Activate this account before sending a password reset.');
        }
        $token = bin2hex(random_bytes(32));
        $minutes = (int) $this->config->get('auth.reset_token_minutes', 60);
        $this->resets->issue($id, hash('sha256', $token), $minutes, $request->ip());
        $this->mail->sendTemplate((string) $target['email'], (string) $target['full_name'], 'password-reset', [
            'name' => $target['full_name'],
            'link' => $this->config->get('frontend_url') . '/reset-password?token=' . $token,
            'minutes' => $minutes,
        ]);
        $this->record($request, 'admin.user_password_reset_sent', 'user', $id);
        return $this->message('A password reset link has been sent to the user.');
    }

    private function assertNotLastAdmin(array $target, string $field): void
    {
        if ($target['role'] === 'admin' && Model::flag($target['is_active']) && $this->repository->activeAdminCount() <= 1) {
            throw ValidationException::withField($field, 'At least one active administrator must remain.');
        }
    }

    private function present(array $row): array
    {
        return [
            'id' => $row['id'],
            'email' => $row['email'],
            'full_name' => $row['full_name'],
            'phone' => $row['phone'] ?? null,
            'role' => $row['role'],
            'is_active' => Model::flag($row['is_active']),
            'email_verified' => !empty($row['email_verified_at']),
            'last_login_at' => Model::iso($row['last_login_at'] ?? null),
            'created_at' => Model::iso($row['created_at'] ?? null),
        ];
    }
}
