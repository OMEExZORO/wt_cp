<?php

declare(strict_types=1);

namespace App\Models;

final class RateLimit extends Model
{
    protected const TABLE = 'rate_limits';
    protected const PRIMARY_KEY = 'bucket';

    public function hit(string $bucket, int $windowSeconds): array
    {
        return $this->fetchOne(
            'INSERT INTO rate_limits (bucket, hits, window_started_at) VALUES (:bucket, 1, now())
             ON CONFLICT (bucket) DO UPDATE SET
                hits = CASE WHEN rate_limits.window_started_at <= now() - make_interval(secs => :window_a) THEN 1 ELSE rate_limits.hits + 1 END,
                window_started_at = CASE WHEN rate_limits.window_started_at <= now() - make_interval(secs => :window_b) THEN now() ELSE rate_limits.window_started_at END
             RETURNING hits, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_started_at + make_interval(secs => :window_c) - now()))))::int AS retry_after',
            ['bucket' => $bucket, 'window_a' => $windowSeconds, 'window_b' => $windowSeconds, 'window_c' => $windowSeconds]
        ) ?? ['hits' => 1, 'retry_after' => $windowSeconds];
    }

    public function clear(string $bucket): void
    {
        $this->execute('DELETE FROM rate_limits WHERE bucket = :bucket', ['bucket' => $bucket]);
    }

    public function purgeOlderThan(int $seconds): int
    {
        return $this->execute(
            'DELETE FROM rate_limits WHERE window_started_at < now() - make_interval(secs => :seconds)',
            ['seconds' => $seconds]
        );
    }
}
