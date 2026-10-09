<?php

declare(strict_types=1);

namespace App\Models;

final class AdminRepository extends Model
{
    public const USER_COLUMNS = 'id, email, full_name, phone, role, is_active, email_verified_at, last_login_at, locked_until, created_at, updated_at';

    public function users(array $filters, int $limit, int $offset): array
    {
        [$where, $params] = $this->userWhere($filters);
        return $this->fetchAll(
            'SELECT ' . self::USER_COLUMNS . ' FROM users' . $where . ' ORDER BY created_at DESC, id LIMIT ' . $limit . ' OFFSET ' . $offset,
            $params
        );
    }

    public function userCount(array $filters): int
    {
        [$where, $params] = $this->userWhere($filters);
        return (int) $this->fetchValue('SELECT count(*) FROM users' . $where, $params);
    }

    public function userById(string $id): ?array
    {
        return $this->fetchOne('SELECT ' . self::USER_COLUMNS . ' FROM users WHERE id = :id', ['id' => $id]);
    }

    public function activeAdminCount(): int
    {
        return (int) $this->fetchValue("SELECT count(*) FROM users WHERE role = 'admin' AND is_active = TRUE");
    }

    public function branches(): array
    {
        return $this->fetchAll('SELECT * FROM branches ORDER BY sort_order, name');
    }

    public function categories(): array
    {
        return $this->fetchAll(
            'SELECT c.*, p.name AS parent_name FROM scan_categories c LEFT JOIN scan_categories p ON p.id = c.parent_id ORDER BY c.modality, c.sort_order, c.name'
        );
    }

    public function scanTypes(array $filters, int $limit, int $offset): array
    {
        [$where, $params] = $this->scanTypeWhere($filters);
        return $this->fetchAll(
            'SELECT t.id, t.category_id, t.slug, t.modality, t.name, t.short_description, t.preparation_tips, t.duration_minutes, t.fee_inr,
                    t.is_bookable_online, t.is_active, t.sort_order, c.name AS category_name
             FROM scan_types t JOIN scan_categories c ON c.id = t.category_id' . $where . '
             ORDER BY t.modality, c.sort_order, t.sort_order, t.name LIMIT ' . $limit . ' OFFSET ' . $offset,
            $params
        );
    }

    public function scanTypeCount(array $filters): int
    {
        [$where, $params] = $this->scanTypeWhere($filters);
        return (int) $this->fetchValue('SELECT count(*) FROM scan_types t JOIN scan_categories c ON c.id = t.category_id' . $where, $params);
    }

    public function checklistItems(array $filters): array
    {
        $sql = 'SELECT i.id, i.scan_type_id, i.modality, i.code, i.question, i.help_text, i.answer_type, i.is_required, i.attention_answers,
                       i.sort_order, i.is_active, t.name AS scan_type_name
                FROM checklist_items i LEFT JOIN scan_types t ON t.id = i.scan_type_id WHERE 1 = 1';
        $params = [];
        if (isset($filters['scan_type_id'])) {
            $sql .= ' AND i.scan_type_id = :scan_type_id';
            $params['scan_type_id'] = $filters['scan_type_id'];
        }
        if (isset($filters['modality'])) {
            $sql .= ' AND (i.modality = :modality OR t.modality = :modality)';
            $params['modality'] = $filters['modality'];
        }
        return $this->fetchAll($sql . ' ORDER BY coalesce(i.modality, t.modality), i.scan_type_id NULLS FIRST, i.sort_order, i.code', $params);
    }

    public function checklistItem(string $id): ?array
    {
        return $this->fetchOne(
            'SELECT id, scan_type_id, modality, code, question, help_text, answer_type, is_required, attention_answers, sort_order, is_active
             FROM checklist_items WHERE id = :id',
            ['id' => $id]
        );
    }

    public function insertChecklistItem(array $data): array
    {
        return $this->fetchOne(
            'INSERT INTO checklist_items (scan_type_id, modality, code, question, help_text, answer_type, is_required, attention_answers, sort_order, is_active)
             VALUES (:scan_type_id, :modality, :code, :question, :help_text, :answer_type, :is_required, CAST(:attention_answers AS text[]), :sort_order, :is_active)
             RETURNING id, scan_type_id, modality, code, question, help_text, answer_type, is_required, attention_answers, sort_order, is_active',
            $data
        ) ?? [];
    }

    public function updateChecklistItem(string $id, array $data): ?array
    {
        $data['id'] = $id;
        return $this->fetchOne(
            'UPDATE checklist_items SET scan_type_id = :scan_type_id, modality = :modality, code = :code, question = :question, help_text = :help_text,
                    answer_type = :answer_type, is_required = :is_required, attention_answers = CAST(:attention_answers AS text[]),
                    sort_order = :sort_order, is_active = :is_active
             WHERE id = :id
             RETURNING id, scan_type_id, modality, code, question, help_text, answer_type, is_required, attention_answers, sort_order, is_active',
            $data
        );
    }

    public function faqs(): array
    {
        return $this->fetchAll('SELECT * FROM faqs ORDER BY sort_order, question');
    }

    public function settings(): array
    {
        return $this->fetchAll(
            'SELECT key, value, value_type, group_name, label, is_public, is_placeholder, updated_at FROM site_settings ORDER BY group_name, key'
        );
    }

    public function settingsByKeys(array $keys): array
    {
        if ($keys === []) {
            return [];
        }
        $params = [];
        $holders = [];
        foreach (array_values($keys) as $i => $key) {
            $params['k' . $i] = $key;
            $holders[] = ':k' . $i;
        }
        $rows = $this->fetchAll(
            'SELECT key, value, value_type, group_name, label, is_public, is_placeholder FROM site_settings WHERE key IN (' . implode(', ', $holders) . ') FOR UPDATE',
            $params
        );
        $byKey = [];
        foreach ($rows as $row) {
            $byKey[(string) $row['key']] = $row;
        }
        return $byKey;
    }

    public function writeSetting(string $key, ?string $value, bool $placeholder, ?string $userId): void
    {
        $this->execute(
            'UPDATE site_settings SET value = :value, is_placeholder = :placeholder, updated_by_user_id = :user_id WHERE key = :key',
            ['value' => $value, 'placeholder' => $placeholder, 'user_id' => $userId, 'key' => $key]
        );
    }

    public function slots(array $filters, int $limit, int $offset): array
    {
        [$where, $params] = $this->slotWhere($filters);
        return $this->fetchAll(
            'SELECT s.id, s.branch_id, s.modality, s.slot_date, s.start_time, s.end_time, s.capacity, s.booked_count, s.is_blocked, b.name AS branch_name
             FROM slots s JOIN branches b ON b.id = s.branch_id' . $where . '
             ORDER BY s.slot_date, s.start_time, b.sort_order, s.modality LIMIT ' . $limit . ' OFFSET ' . $offset,
            $params
        );
    }

    public function slotCount(array $filters): int
    {
        [$where, $params] = $this->slotWhere($filters);
        return (int) $this->fetchValue('SELECT count(*) FROM slots s' . $where, $params);
    }

    public function slotById(string $id): ?array
    {
        return $this->fetchOne(
            'SELECT s.id, s.branch_id, s.modality, s.slot_date, s.start_time, s.end_time, s.capacity, s.booked_count, s.is_blocked, b.name AS branch_name
             FROM slots s JOIN branches b ON b.id = s.branch_id WHERE s.id = :id',
            ['id' => $id]
        );
    }

    public function lockSlot(string $id): ?array
    {
        return $this->fetchOne('SELECT id, capacity, booked_count, is_blocked FROM slots WHERE id = :id FOR UPDATE', ['id' => $id]);
    }

    public function updateSlot(string $id, int $capacity, bool $blocked): void
    {
        $this->execute('UPDATE slots SET capacity = :capacity, is_blocked = :blocked WHERE id = :id', ['capacity' => $capacity, 'blocked' => $blocked, 'id' => $id]);
    }

    public function reviews(?string $status, int $limit, int $offset): array
    {
        $params = [];
        $where = '';
        if ($status !== null) {
            $where = ' WHERE r.status = :status';
            $params['status'] = $status;
        }
        return $this->fetchAll(
            'SELECT r.id, r.display_name, r.rating, r.body, r.status, r.verified_visit, r.is_demo, r.appointment_id, r.moderated_at, r.moderation_note, r.created_at, r.source, r.source_url, r.external_review_date, r.reviewer_photo_url
             FROM reviews r' . $where . ' ORDER BY (r.status = \'pending\') DESC, r.created_at DESC LIMIT ' . $limit . ' OFFSET ' . $offset,
            $params
        );
    }

    public function reviewCount(?string $status): int
    {
        return $status === null
            ? (int) $this->fetchValue('SELECT count(*) FROM reviews')
            : (int) $this->fetchValue('SELECT count(*) FROM reviews WHERE status = :status', ['status' => $status]);
    }

    private function userWhere(array $filters): array
    {
        $clauses = [];
        $params = [];
        if (isset($filters['role'])) {
            $clauses[] = 'role = :role';
            $params['role'] = $filters['role'];
        }
        if (isset($filters['is_active'])) {
            $clauses[] = 'is_active = :is_active';
            $params['is_active'] = (bool) $filters['is_active'];
        }
        if (isset($filters['q']) && $filters['q'] !== '') {
            $clauses[] = '(full_name ILIKE :q OR email ILIKE :q)';
            $params['q'] = '%' . ScanType::escapeLike((string) $filters['q']) . '%';
        }
        return [$clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses), $params];
    }

    private function scanTypeWhere(array $filters): array
    {
        $clauses = [];
        $params = [];
        if (isset($filters['modality'])) {
            $clauses[] = 't.modality = :modality';
            $params['modality'] = $filters['modality'];
        }
        if (isset($filters['category_id'])) {
            $clauses[] = 't.category_id = :category_id';
            $params['category_id'] = $filters['category_id'];
        }
        if (isset($filters['q']) && $filters['q'] !== '') {
            $clauses[] = 't.name ILIKE :q';
            $params['q'] = '%' . ScanType::escapeLike((string) $filters['q']) . '%';
        }
        return [$clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses), $params];
    }

    private function slotWhere(array $filters): array
    {
        $clauses = [];
        $params = [];
        foreach (['branch_id' => 's.branch_id', 'modality' => 's.modality'] as $key => $column) {
            if (isset($filters[$key])) {
                $clauses[] = $column . ' = :' . $key;
                $params[$key] = $filters[$key];
            }
        }
        if (isset($filters['date'])) {
            $clauses[] = 's.slot_date = CAST(:slot_date AS date)';
            $params['slot_date'] = $filters['date'];
        }
        return [$clauses === [] ? '' : ' WHERE ' . implode(' AND ', $clauses), $params];
    }
}
