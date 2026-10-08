<?php

declare(strict_types=1);

use App\Core\Env;

require dirname(__DIR__) . '/config/bootstrap.php';

function storageRequest(string $method, string $url, string $serviceKey, ?array $body = null): array
{
    $handle = curl_init($url);
    $headers = [
        'Authorization: Bearer ' . $serviceKey,
        'apikey: ' . $serviceKey,
        'Content-Type: application/json',
    ];
    curl_setopt_array($handle, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
    ]);
    if ($body !== null) {
        curl_setopt($handle, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
    }
    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    return [$status, is_string($response) ? json_decode($response, true) : null];
}

$baseUrl = rtrim(Env::require('SUPABASE_URL'), '/') . '/storage/v1';
$serviceKey = Env::require('SUPABASE_SERVICE_KEY');
$bucket = Env::get('STORAGE_BUCKET', 'reports');

[$status, $existing] = storageRequest('GET', $baseUrl . '/bucket/' . rawurlencode($bucket), $serviceKey);

if ($status === 200 && is_array($existing)) {
    if (($existing['public'] ?? true) !== false) {
        fwrite(STDERR, sprintf('ERROR: bucket "%s" exists but is public. Make it private in the Supabase dashboard.', $bucket) . PHP_EOL);
        exit(1);
    }
    fwrite(STDOUT, sprintf('Bucket "%s" already exists and is private.', $bucket) . PHP_EOL);
    exit(0);
}

[$status, $created] = storageRequest('POST', $baseUrl . '/bucket', $serviceKey, [
    'id' => $bucket,
    'name' => $bucket,
    'public' => false,
    'file_size_limit' => 15728640,
]);

if ($status !== 200) {
    fwrite(STDERR, sprintf('ERROR: could not create bucket "%s" (HTTP %d).', $bucket, $status) . PHP_EOL);
    exit(1);
}

fwrite(STDOUT, sprintf('Created private bucket "%s".', $bucket) . PHP_EOL);
