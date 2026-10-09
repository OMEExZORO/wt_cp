<?php

declare(strict_types=1);

use App\Core\Database;
use App\Models\Slot;
use App\Services\Booking\SlotGenerator;

require dirname(__DIR__) . '/config/bootstrap.php';

$usage = <<<'TXT'
Usage: php backend/bin/generate-slots.php [options]

  --days=30              number of days to generate, starting at --from (1 to 366)
  --from=YYYY-MM-DD      first day (default: today)
  --open=09:00           first slot start time
  --close=17:00          closing time; the last slot ends at or before it
  --interval=30          slot length in minutes
  --capacity=USG:2,CT:1,BIOPSY:1   patients per slot for each modality
  --branch=slug[,slug]   only these branch slugs (default: every active branch)
  --closed=7             ISO weekdays with no slots, comma separated (1 = Monday, 7 = Sunday)
  --dry-run              print what would be created without writing
TXT;

$options = getopt('', ['days:', 'from:', 'open:', 'close:', 'interval:', 'capacity:', 'branch:', 'closed:', 'dry-run', 'help']);
if ($options === false || isset($options['help'])) {
    fwrite(STDOUT, $usage . PHP_EOL);
    exit(isset($options['help']) ? 0 : 1);
}

$fail = static function (string $message): never {
    fwrite(STDERR, 'ERROR: ' . $message . PHP_EOL);
    exit(1);
};

$days = (int) ($options['days'] ?? 30);
$from = (string) ($options['from'] ?? date('Y-m-d'));
if (DateTimeImmutable::createFromFormat('!Y-m-d', $from) === false) {
    $fail('--from must be YYYY-MM-DD');
}
$open = (string) ($options['open'] ?? '09:00');
$close = (string) ($options['close'] ?? '17:00');
foreach ([$open, $close] as $time) {
    if (preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time) !== 1) {
        $fail('--open and --close must be HH:MM');
    }
}
$interval = (int) ($options['interval'] ?? 30);

$capacities = SlotGenerator::DEFAULT_CAPACITY;
if (isset($options['capacity'])) {
    $capacities = [];
    foreach (explode(',', (string) $options['capacity']) as $pair) {
        if (preg_match('/^(USG|CT|BIOPSY):(\d{1,2})$/', trim($pair), $m) !== 1) {
            $fail('--capacity must look like USG:2,CT:1,BIOPSY:1');
        }
        $capacities[$m[1]] = (int) $m[2];
    }
}

$closed = [];
foreach (array_filter(explode(',', (string) ($options['closed'] ?? '7')), static fn (string $v): bool => trim($v) !== '') as $day) {
    if (preg_match('/^[1-7]$/', trim($day)) !== 1) {
        $fail('--closed must be ISO weekday numbers 1 to 7');
    }
    $closed[] = (int) trim($day);
}

try {
    $pdo = Database::migrationConnection();
} catch (Throwable $e) {
    $fail('Could not connect to the database.');
}

$branchRows = $pdo->query('SELECT id, slug, name FROM branches WHERE is_active = TRUE ORDER BY sort_order, name')->fetchAll(PDO::FETCH_ASSOC);
if (isset($options['branch'])) {
    $wanted = array_map('trim', explode(',', (string) $options['branch']));
    $branchRows = array_values(array_filter($branchRows, static fn (array $b): bool => in_array($b['slug'], $wanted, true)));
}
if ($branchRows === []) {
    $fail('No active branches matched.');
}

try {
    $rows = SlotGenerator::plan(array_column($branchRows, 'id'), $capacities, $from, $days, $open, $close, $interval, $closed);
} catch (InvalidArgumentException $e) {
    $fail($e->getMessage());
}

fwrite(STDOUT, sprintf(
    "Branches: %s\nDays: %d from %s (closed weekdays: %s)\nHours: %s to %s every %d min\nCapacity: %s\nCandidate slots: %d\n",
    implode(', ', array_column($branchRows, 'slug')),
    $days,
    $from,
    $closed === [] ? 'none' : implode(',', $closed),
    $open,
    $close,
    $interval,
    implode(', ', array_map(static fn (string $k, int $v): string => $k . ':' . $v, array_keys($capacities), $capacities)),
    count($rows)
));

if (isset($options['dry-run'])) {
    fwrite(STDOUT, "Dry run, nothing written.\n");
    exit(0);
}

$pdo->beginTransaction();
try {
    $inserted = (new SlotGenerator(new Slot($pdo)))->insert($rows);
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    $fail('Slot generation failed and was rolled back: ' . $e->getMessage());
}
fwrite(STDOUT, sprintf("Inserted %d new slot(s); %d already existed and were left unchanged.\n", $inserted, count($rows) - $inserted));
