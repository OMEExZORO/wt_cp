<?php

declare(strict_types=1);

use App\Core\Env;

return static function (PDO $pdo): array {
    if (Env::get('APP_ENV', 'production') === 'production') {
        throw new RuntimeException('The dev seed is disabled when APP_ENV=production.');
    }

    $devPassword = (string) Env::get('DEV_SEED_PASSWORD', '');
    if (strlen($devPassword) < 10) {
        throw new RuntimeException('Set DEV_SEED_PASSWORD (at least 10 characters) before running the dev seed.');
    }

    $users = [
        ['email' => 'admin@diagnocare.test', 'role' => 'admin', 'name' => 'Dev Admin', 'phone' => '9000000001'],
        ['email' => 'doctor@diagnocare.test', 'role' => 'doctor', 'name' => 'Dev Doctor', 'phone' => '9000000002'],
        ['email' => 'reception@diagnocare.test', 'role' => 'receptionist', 'name' => 'Dev Receptionist', 'phone' => '9000000003'],
        ['email' => 'patient@diagnocare.test', 'role' => 'patient', 'name' => 'Dev Patient', 'phone' => '9000000004'],
        ['email' => 'referrer@diagnocare.test', 'role' => 'referrer', 'name' => 'Dev Referrer', 'phone' => '9000000005'],
    ];

    $upsertUser = $pdo->prepare(
        'INSERT INTO users (email, password_hash, role, full_name, phone, email_verified_at, password_changed_at)
         VALUES (:email, :password_hash, :role, :full_name, :phone, now(), now())
         ON CONFLICT ((lower(email))) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             full_name = EXCLUDED.full_name,
             phone = EXCLUDED.phone,
             is_active = TRUE,
             failed_login_count = 0,
             locked_until = NULL
         RETURNING id'
    );

    $ids = [];
    foreach ($users as $user) {
        $upsertUser->execute([
            'email' => $user['email'],
            'password_hash' => password_hash($devPassword, PASSWORD_ARGON2ID),
            'role' => $user['role'],
            'full_name' => $user['name'],
            'phone' => $user['phone'],
        ]);
        $ids[$user['role']] = (string) $upsertUser->fetchColumn();
    }

    $patient = $pdo->prepare(
        'INSERT INTO patients (user_id, full_name, date_of_birth, gender, phone, email, city, consent_given_at, consent_version)
         VALUES (:user_id, :full_name, :dob, :gender, :phone, :email, :city, now(), :consent_version)
         ON CONFLICT (user_id) DO NOTHING'
    );
    $patient->execute([
        'user_id' => $ids['patient'],
        'full_name' => 'Dev Patient',
        'dob' => '1990-01-15',
        'gender' => 'prefer_not_to_say',
        'phone' => '9000000004',
        'email' => 'patient@diagnocare.test',
        'city' => 'Pune',
        'consent_version' => '2026-10-v1',
    ]);

    $referrer = $pdo->prepare(
        'INSERT INTO referrers (user_id, full_name, qualification, clinic_name, phone, city, verified_at, verified_by_user_id)
         VALUES (:user_id, :full_name, :qualification, :clinic_name, :phone, :city, now(), :verified_by)
         ON CONFLICT (user_id) DO NOTHING'
    );
    $referrer->execute([
        'user_id' => $ids['referrer'],
        'full_name' => 'Dev Referrer',
        'qualification' => 'MBBS',
        'clinic_name' => 'Dev Referral Clinic',
        'phone' => '9000000005',
        'city' => 'Pune',
        'verified_by' => $ids['admin'],
    ]);


    $slots = $pdo->exec(
        "INSERT INTO slots (branch_id, modality, slot_date, start_time, end_time, capacity)
         SELECT b.id, m.modality, d::date, t::time, (t + interval '30 minutes')::time, m.capacity
         FROM branches b
         CROSS JOIN (VALUES ('USG', 2), ('CT', 1), ('BIOPSY', 1)) AS m (modality, capacity)
         CROSS JOIN generate_series(current_date + 1, current_date + 30, interval '1 day') AS d
         CROSS JOIN generate_series(timestamp '2000-01-01 08:00', timestamp '2000-01-01 21:30', interval '30 minutes') AS t
         WHERE b.is_active AND extract(isodow FROM d) < 7
         ON CONFLICT ON CONSTRAINT slots_branch_modality_date_time_unique DO NOTHING"
    );

    return ['users' => count($ids), 'slots_inserted' => (int) $slots];
};
