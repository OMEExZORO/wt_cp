<?php

declare(strict_types=1);

use App\Core\Database;
use App\Core\Env;

$paths = require dirname(__DIR__) . '/config/bootstrap.php';

$base = rtrim($argv[1] ?? 'http://localhost:8021/api/v1', '/');
$jsonOut = in_array('--json', $argv, true);

if (Env::get('APP_ENV', 'production') === 'production') {
    fwrite(STDERR, "Refusing to run against APP_ENV=production.\n");
    exit(2);
}

final class Http
{
    private array $jar = [];
    private ?string $csrf = null;

    public function __construct(private readonly string $base)
    {
    }

    public function request(string $method, string $path, ?array $json = null, ?array $multipart = null, array $query = []): array
    {
        if ($method !== 'GET' && $path !== '/auth/csrf') {
            $this->csrf();
        }
        $url = $this->base . $path . ($query === [] ? '' : '?' . http_build_query($query));
        $headers = ['Accept: application/json'];
        if ($this->csrf !== null && $method !== 'GET') {
            $headers[] = 'X-CSRF-Token: ' . $this->csrf;
        }
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_TIMEOUT => 60,
        ]);
        if ($json !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($json, JSON_UNESCAPED_SLASHES));
        } elseif ($multipart !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $multipart);
        }
        if ($this->jar !== []) {
            $pairs = [];
            foreach ($this->jar as $name => $value) {
                $pairs[] = $name . '=' . $value;
            }
            $headers[] = 'Cookie: ' . implode('; ', $pairs);
        }
        curl_setopt($handle, CURLOPT_HTTPHEADER, $headers);
        $raw = (string) curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $headerSize = (int) curl_getinfo($handle, CURLINFO_HEADER_SIZE);
        curl_close($handle);
        $head = substr($raw, 0, $headerSize);
        $body = substr($raw, $headerSize);
        foreach (explode("\r\n", $head) as $line) {
            if (stripos($line, 'set-cookie:') === 0) {
                $cookie = trim(substr($line, 11));
                [$pair] = explode(';', $cookie, 2);
                [$name, $value] = array_pad(explode('=', $pair, 2), 2, '');
                if ($value === '' || stripos($cookie, 'expires=Thu, 01 Jan 1970') !== false) {
                    unset($this->jar[$name]);
                } else {
                    $this->jar[$name] = $value;
                }
            }
        }
        $decoded = json_decode($body, true);
        return ['status' => $status, 'json' => is_array($decoded) ? $decoded : null, 'body' => $body];
    }

    public function csrf(): void
    {
        $response = $this->request('GET', '/auth/csrf');
        $this->csrf = $response['json']['data']['csrf_token'] ?? null;
    }

    public function login(string $email, string $password): array
    {
        $this->csrf();
        return $this->request('POST', '/auth/login', ['email' => $email, 'password' => $password]);
    }
}

$pdo = Database::migrationConnection();
$tables = ['users', 'patients', 'referrers', 'appointments', 'reports', 'critical_alerts', 'email_verifications', 'referrals', 'reviews', 'faqs', 'slots', 'scan_types', 'branches'];

$query = static function (string $sql) use (&$pdo): array {
    for ($attempt = 0; $attempt < 3; $attempt++) {
        try {
            return $pdo->query($sql)->fetch() ?: [];
        } catch (PDOException $e) {
            $pdo = Database::migrationConnection();
        }
    }
    throw new RuntimeException('Database unreachable');
};

$snapshot = static function () use ($query, $tables, $paths): array {
    $parts = [];
    foreach ($tables as $table) {
        $parts[] = sprintf('(SELECT count(*) FROM %1$s) AS %1$s', $table);
    }
    $parts[] = '(SELECT COALESCE(sum(booked_count),0) FROM slots) AS slots_booked_sum';
    $parts[] = "(SELECT COALESCE(string_agg(full_name, '|' ORDER BY id), '') FROM patients) AS patient_names";
    $row = $query('SELECT ' . implode(', ', $parts));
    $counts = [];
    foreach ($tables as $table) {
        $counts[$table] = (int) $row[$table];
    }
    $files = 0;
    $dir = $paths['backend_root'] . '/storage/reports';
    if (is_dir($dir)) {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            $files += $file->isFile() ? 1 : 0;
        }
    }
    $counts['storage_files'] = $files;
    $counts['slots_booked_sum'] = (int) $row['slots_booked_sum'];
    $counts['patient_names_hash'] = crc32((string) $row['patient_names']);
    return $counts;
};

$clearThrottle = static function () use ($query): void {
    $query('WITH d AS (DELETE FROM rate_limits RETURNING 1) SELECT count(*) FROM d');
};

$attacks = [
    'sqli_tautology' => "' OR '1'='1",
    'sqli_drop_table' => "'; DROP TABLE users;--",
    'xss_script' => '<script>alert(1)</script>',
    'oversized' => str_repeat('A', 20000),
];

$results = [];
$record = static function (string $group, string $name, string $input, array $expectedStatuses, array $response, array $before, array $after) use (&$results): void {
    $statusOk = in_array($response['status'], $expectedStatuses, true);
    $envelopeOk = $response['json'] !== null && array_key_exists('error', $response['json']) && ($response['json']['data'] ?? null) === null && isset($response['json']['error']['code']);
    $unchanged = $before === $after;
    $diff = [];
    foreach ($after as $key => $value) {
        if (($before[$key] ?? null) !== $value) {
            $diff[] = $key . ' ' . ($before[$key] ?? '?') . '->' . $value;
        }
    }
    $results[] = [
        'group' => $group,
        'name' => $name,
        'input' => mb_strlen($input) > 60 ? mb_substr($input, 0, 40) . '...(' . mb_strlen($input) . ' chars)' : $input,
        'expected' => implode('/', $expectedStatuses) . ' + error envelope + no rows written',
        'status' => $response['status'],
        'code' => $response['json']['error']['code'] ?? '-',
        'unchanged' => $unchanged,
        'diff' => implode(', ', $diff),
        'pass' => $statusOk && $envelopeOk && $unchanged,
    ];
};

$run = static function (string $group, string $name, string $input, array $expected, callable $request) use ($snapshot, $record): void {
    $before = $snapshot();
    $response = $request();
    $after = $snapshot();
    $record($group, $name, $input, $expected, $response, $before, $after);
};

$clearThrottle();
$anon = new Http($base);
$suffix = bin2hex(random_bytes(3));
$validRegistration = static fn (array $override = []): array => array_merge([
    'account_type' => 'patient',
    'full_name' => 'Attack Probe',
    'email' => 'attack.' . $suffix . '@diagnocare.test',
    'phone' => '9876543210',
    'password' => 'Attack@Probe2026!',
    'password_confirmation' => 'Attack@Probe2026!',
    'consent' => true,
], $override);

foreach ($attacks as $label => $payload) {
    foreach (['full_name', 'email', 'city'] as $field) {
        $clearThrottle();
        $value = $field === 'email' ? $payload . '@diagnocare.test' : $payload;
        $run('register', "$label in $field", $payload, [422], static fn () => $anon->request('POST', '/auth/register', $validRegistration([$field => $value])));
    }
}
$clearThrottle();

foreach ($attacks as $label => $payload) {
    $run('login', "$label in email", $payload, [422, 401], static fn () => (function () use ($anon, $payload) {
        $anon->csrf();
        return $anon->request('POST', '/auth/login', ['email' => $payload, 'password' => 'Whatever@2026!']);
    })());
}
$run('login', 'sqli_tautology in password', $attacks['sqli_tautology'], [401], static fn () => (function () use ($anon, $attacks) {
    $anon->csrf();
    return $anon->request('POST', '/auth/login', ['email' => 'patient@diagnocare.test', 'password' => $attacks['sqli_tautology']]);
})());
$clearThrottle();

$patient = new Http($base);
$login = $patient->login('patient@diagnocare.test', 'Patient@Dev2026!');
if ($login['status'] !== 200) {
    fwrite(STDERR, "Could not log in as the dev patient (HTTP {$login['status']}). Is the dev seed applied?\n");
    exit(2);
}

$branches = $anon->request('GET', '/public/branches')['json']['data'];
$branchList = $branches['branches'] ?? $branches;
$branchId = null;
foreach ($branchList as $branch) {
    if (($branch['is_active'] ?? true) !== false) {
        $branchId = $branch['id'];
        break;
    }
}
$typesData = $anon->request('GET', '/public/scan-types')['json']['data'];
$typeList = $typesData['scan_types'] ?? $typesData;
$scan = null;
foreach ($typeList as $type) {
    if ($type['modality'] === 'USG' && ($type['is_bookable_online'] ?? true) !== false) {
        $scan = $type;
        break;
    }
}
$slotId = null;
for ($offset = 1; $offset <= 14 && $slotId === null; $offset++) {
    $date = date('Y-m-d', time() + $offset * 86400);
    $availability = $patient->request('GET', '/booking/availability', null, null, ['branch_id' => $branchId, 'scan_type_id' => $scan['id'], 'date' => $date]);
    foreach ($availability['json']['data']['slots'] ?? [] as $slot) {
        if ($slot['is_available']) {
            $slotId = $slot['id'];
            break;
        }
    }
}
if ($slotId === null) {
    fwrite(STDERR, "No open slot found to attack the booking endpoint.\n");
    exit(2);
}
$checklist = $patient->request('GET', '/scan-types/' . $scan['id'] . '/checklist')['json']['data']['items'];
$answers = [];
foreach ($checklist as $item) {
    $answers[$item['id']] = $item['answer_type'] === 'text' ? 'None' : ($item['answer_type'] === 'date' ? '2026-01-01' : 'no');
}

foreach ($attacks as $label => $payload) {
    $run('booking', "$label in patient_notes", $payload, [422], static fn () => $patient->request('POST', '/appointments', [
        'scan_type_id' => $scan['id'],
        'slot_id' => $slotId,
        'consent' => true,
        'patient_notes' => $payload,
        'answers' => $answers,
    ]));
}
$run('booking', 'sqli in slot_id', $attacks['sqli_tautology'], [422], static fn () => $patient->request('POST', '/appointments', [
    'scan_type_id' => $scan['id'],
    'slot_id' => $attacks['sqli_tautology'],
    'consent' => true,
    'answers' => $answers,
]));
$run('booking', 'booking without consent', 'consent=false', [422], static fn () => $patient->request('POST', '/appointments', [
    'scan_type_id' => $scan['id'],
    'slot_id' => $slotId,
    'consent' => false,
    'answers' => $answers,
]));

foreach ($attacks as $label => $payload) {
    $run('profile', "$label in full_name", $payload, [422], static fn () => $patient->request('PATCH', '/auth/me', ['full_name' => $payload]));
}

$doctor = new Http($base);
$doctor->login('doctor@diagnocare.test', 'Doctor@Dev2026!');

foreach ($attacks as $label => $payload) {
    $run('search', "$label in query string q (staff list)", $payload, [422], static fn () => $doctor->request('GET', '/appointments', null, null, ['q' => $payload]));
}
$appointments = $doctor->request('GET', '/appointments', null, null, ['per_page' => 1]);
$appointmentId = $appointments['json']['data']['appointments'][0]['id'] ?? null;
if ($appointmentId === null) {
    fwrite(STDERR, "No appointment exists to attach reports to.\n");
    exit(2);
}

$pdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";
$tmp = sys_get_temp_dir() . '/dc-attack-' . $suffix;
@mkdir($tmp);
$makeFile = static function (string $name, string $contents) use ($tmp): string {
    $path = $tmp . '/' . $name;
    file_put_contents($path, $contents);
    return $path;
};
$upload = static function (string $path, string $uploadName, array $fields = []) use ($doctor, $appointmentId): array {
    return $doctor->request('POST', '/reports', null, array_merge([
        'appointment_id' => $appointmentId,
        'title' => 'Attack probe report',
        'status' => 'final',
        'file' => new CURLFile($path, 'application/pdf', $uploadName),
    ], $fields));
};

$validFile = $makeFile('valid-source.pdf', $pdf);
foreach ($attacks as $label => $payload) {
    $run('report-upload', "$label in title", $payload, [422], static fn () => $upload($validFile, 'ok.pdf', ['title' => $payload]));
}
$run('report-upload', 'oversized notes (5001 chars)', str_repeat('n', 5001), [422], static fn () => $upload($validFile, 'ok.pdf', ['notes' => str_repeat('n', 5001)]));
$run('report-upload', 'sqli in appointment_id', $attacks['sqli_tautology'], [422], static fn () => $upload($validFile, 'ok.pdf', ['appointment_id' => $attacks['sqli_tautology']]));

$wrongFiles = [
    'plain text named .pdf' => ['text.pdf', "this is plain text, not a PDF document\n", [422]],
    'PHP script named .pdf' => ['shell.pdf', "<?php system(\$_GET['c']); ?>", [422]],
    'PNG bytes named .pdf' => ['image.pdf', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), [422]],
    'HTML with script named .pdf' => ['page.pdf', '<html><script>alert(1)</script></html>', [422]],
    'double extension shell.php.pdf with text body' => ['shell.php.pdf', "<?php echo 1;", [422]],
    'valid PDF named .php' => ['report.php', $pdf, [422]],
    'empty file named .pdf' => ['empty.pdf', '', [422]],
    '11 MB file named .pdf' => ['huge.pdf', $pdf . str_repeat('A', 11 * 1048576), [413, 422]],
];
foreach ($wrongFiles as $label => [$uploadName, $contents, $expected]) {
    $path = $makeFile('probe-' . md5($label), $contents);
    $run('report-upload', $label, $uploadName, $expected, static fn () => $upload($path, $uploadName));
}

foreach (glob($tmp . '/*') ?: [] as $file) {
    @unlink($file);
}
@rmdir($tmp);

$tablesStillThere = [];
foreach ($tables as $table) {
    $tablesStillThere[$table] = (int) $query("SELECT count(*) AS n FROM information_schema.tables WHERE table_name = '$table' AND table_schema = 'public'")['n'] === 1;
}
$sanity = new Http($base);
$adminLogin = $sanity->login('admin@diagnocare.test', 'Admin@Dev2026!');
$sqliAudit = (int) $query("SELECT count(*) AS n FROM audit_log WHERE action LIKE 'security.%_attempt' AND created_at > now() - interval '15 minutes'")['n'];
$clearThrottle();

$passed = count(array_filter($results, static fn (array $row): bool => $row['pass']));
$total = count($results);
$allTables = !in_array(false, $tablesStillThere, true);

if ($jsonOut) {
    echo json_encode(['passed' => $passed, 'total' => $total, 'tables_intact' => $allTables, 'admin_login_status' => $adminLogin['status'], 'security_audit_rows_last_15m' => $sqliAudit, 'results' => $results], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
} else {
    foreach ($results as $row) {
        printf("%s  [%s] %s | input: %s | HTTP %d %s | rows %s%s\n", $row['pass'] ? 'PASS' : 'FAIL', $row['group'], $row['name'], $row['input'], $row['status'], $row['code'], $row['unchanged'] ? 'unchanged' : 'CHANGED', $row['diff'] !== '' ? ' (' . $row['diff'] . ')' : '');
    }
    printf("\nTables intact after DROP TABLE attempts: %s\n", $allTables ? 'yes' : 'NO');
    printf("Admin login still works: HTTP %d\n", $adminLogin['status']);
    printf("security.*_attempt audit rows in the last 15 minutes: %d\n", $sqliAudit);
    printf("\nATTACK CHECK RESULT: %d/%d passed\n", $passed, $total);
}

exit($passed === $total && $allTables && $adminLogin['status'] === 200 ? 0 : 1);
