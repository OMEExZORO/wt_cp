<?php

declare(strict_types=1);

use App\Core\Database;
use App\Core\Env;
use App\Exceptions\AppException;
use App\Exceptions\SlotFullException;
use App\Models\Appointment;
use App\Models\AppointmentChecklistAnswer;
use App\Models\Slot;
use App\Services\Booking\BookingService;
use App\Services\Clock;

require dirname(__DIR__) . '/config/bootstrap.php';

$options = getopt('', ['worker', 'slot:', 'patient:', 'scan:', 'start-at:', 'workers:', 'capacity:', 'keep', 'help']);

if (isset($options['help'])) {
    fwrite(STDOUT, "Usage: php backend/bin/prove-booking-concurrency.php [--workers=8] [--capacity=1] [--keep]\n");
    exit(0);
}

if (Env::get('APP_ENV', 'production') === 'production') {
    fwrite(STDERR, "ERROR: this proof writes temporary rows and is disabled when APP_ENV=production.\n");
    exit(1);
}

if (isset($options['worker'])) {
    $pdo = Database::connection();
    $pdo->query('SELECT 1')->fetchColumn();
    $scan = $pdo->prepare('SELECT id, modality FROM scan_types WHERE id = :id');
    $scan->execute(['id' => (string) $options['scan']]);
    $scanRow = $scan->fetch(PDO::FETCH_ASSOC);
    $service = new BookingService(new Slot($pdo), new Appointment($pdo), new AppointmentChecklistAnswer($pdo), new Clock());
    $startAt = (float) $options['start-at'];
    while (microtime(true) < $startAt) {
        usleep(200);
    }
    $began = microtime(true);
    $result = ['pid' => getmypid(), 'patient' => (string) $options['patient']];
    try {
        $id = $service->book((string) $options['patient'], $scanRow, (string) $options['slot'], [], 'Concurrency proof', 'Routine', null);
        $result += ['outcome' => 'booked', 'status' => 201, 'appointment_id' => $id];
    } catch (SlotFullException $e) {
        $result += ['outcome' => 'slot_full', 'status' => $e->status(), 'suggestion' => $e->suggestion() !== null];
    } catch (AppException $e) {
        $result += ['outcome' => 'rejected', 'status' => $e->status(), 'message' => $e->getMessage()];
    } catch (Throwable $e) {
        $result += ['outcome' => 'error', 'status' => 500, 'message' => $e::class . ': ' . $e->getMessage()];
    }
    $result['began_offset_ms'] = round(($began - $startAt) * 1000, 2);
    $result['duration_ms'] = round((microtime(true) - $began) * 1000, 1);
    fwrite(STDOUT, json_encode($result, JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
}

$workers = max(2, min(32, (int) ($options['workers'] ?? 8)));
$capacity = max(1, min(10, (int) ($options['capacity'] ?? 1)));
$pdo = Database::connection();

$branch = $pdo->query("SELECT id, name FROM branches WHERE is_active = TRUE ORDER BY sort_order, name LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$scan = $pdo->query("SELECT id, name, modality FROM scan_types WHERE modality = 'CT' AND is_active = TRUE ORDER BY sort_order LIMIT 1")->fetch(PDO::FETCH_ASSOC);
if ($branch === false || $scan === false) {
    fwrite(STDERR, "ERROR: run the base and dev seeds first.\n");
    exit(1);
}

$date = (new DateTimeImmutable('today'))->modify('+200 days')->format('Y-m-d');
$minute = random_int(0, 59);
$startTime = sprintf('05:%02d', $minute);
$endTime = sprintf('06:%02d', $minute);

$insertSlot = $pdo->prepare(
    "INSERT INTO slots (branch_id, modality, slot_date, start_time, end_time, capacity)
     VALUES (:branch_id, 'CT', :slot_date, :start_time, :end_time, :capacity) RETURNING id"
);
$insertSlot->execute(['branch_id' => $branch['id'], 'slot_date' => $date, 'start_time' => $startTime, 'end_time' => $endTime, 'capacity' => $capacity]);
$slotId = (string) $insertSlot->fetchColumn();

$patientIds = [];
$insertPatient = $pdo->prepare(
    "INSERT INTO patients (full_name, phone, consent_given_at, consent_version) VALUES (:full_name, NULL, now(), 'concurrency-proof') RETURNING id"
);
for ($i = 1; $i <= $workers; $i++) {
    $insertPatient->execute(['full_name' => 'Concurrency Probe ' . $i]);
    $patientIds[] = (string) $insertPatient->fetchColumn();
}

$cleanup = static function () use ($pdo, $slotId, $patientIds, $options): void {
    if (isset($options['keep'])) {
        fwrite(STDOUT, "Kept temporary rows (--keep): slot {$slotId}\n");
        return;
    }
    $pdo->prepare('DELETE FROM appointments WHERE slot_id = :slot_id')->execute(['slot_id' => $slotId]);
    $pdo->prepare('DELETE FROM slots WHERE id = :id')->execute(['id' => $slotId]);
    $deletePatient = $pdo->prepare("DELETE FROM patients WHERE id = :id AND consent_version = 'concurrency-proof'");
    foreach ($patientIds as $id) {
        $deletePatient->execute(['id' => $id]);
    }
    fwrite(STDOUT, "Temporary slot, patients and appointments removed.\n");
};

fwrite(STDOUT, sprintf("Slot %s at %s, CT, %s %s, capacity %d\nLaunching %d parallel booking processes...\n", $slotId, $branch['name'], $date, $startTime, $capacity, $workers));

$startAt = microtime(true) + 3.0;
$processes = [];
foreach ($patientIds as $patientId) {
    $command = [
        PHP_BINARY, __FILE__, '--worker',
        '--slot=' . $slotId, '--patient=' . $patientId, '--scan=' . $scan['id'], '--start-at=' . sprintf('%.6f', $startAt),
    ];
    $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) {
        $cleanup();
        fwrite(STDERR, "ERROR: could not start a worker process.\n");
        exit(1);
    }
    $processes[] = [$process, $pipes];
}

$results = [];
foreach ($processes as [$process, $pipes]) {
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    proc_close($process);
    $decoded = json_decode(trim((string) $out), true);
    $results[] = is_array($decoded) ? $decoded : ['outcome' => 'error', 'status' => 0, 'message' => trim((string) $err) ?: 'no output'];
}

$counts = array_count_values(array_column($results, 'outcome'));
foreach ($results as $index => $result) {
    fwrite(STDOUT, sprintf(
        "  worker %2d  pid %-6s  %-9s HTTP %d  start +%sms  took %sms%s\n",
        $index + 1,
        (string) ($result['pid'] ?? '-'),
        $result['outcome'],
        (int) $result['status'],
        (string) ($result['began_offset_ms'] ?? '-'),
        (string) ($result['duration_ms'] ?? '-'),
        isset($result['message']) ? '  ' . $result['message'] : ''
    ));
}

$check = $pdo->prepare("SELECT s.booked_count, (SELECT count(*) FROM appointments a WHERE a.slot_id = s.id AND a.status <> 'cancelled') AS active FROM slots s WHERE s.id = :id");
$check->execute(['id' => $slotId]);
$state = $check->fetch(PDO::FETCH_ASSOC);

$booked = $counts['booked'] ?? 0;
$full = $counts['slot_full'] ?? 0;
$passed = $booked === $capacity && $full === $workers - $capacity && (int) $state['booked_count'] === $capacity && (int) $state['active'] === $capacity;

fwrite(STDOUT, sprintf(
    "Result: %d booked, %d refused with 409 slot full, %d other. slots.booked_count = %d, active appointments = %d, capacity = %d\n",
    $booked,
    $full,
    $workers - $booked - $full,
    (int) $state['booked_count'],
    (int) $state['active'],
    $capacity
));
$cleanup();
fwrite(STDOUT, $passed ? "PASS: exactly {$capacity} of {$workers} concurrent attempts succeeded; no double booking.\n" : "FAIL: capacity was not enforced as expected.\n");
exit($passed ? 0 : 1);
