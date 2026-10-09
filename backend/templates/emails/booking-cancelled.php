<?php

declare(strict_types=1);

$subject = 'Appointment cancelled: ' . $scan_name . ' (' . $reference . ')';
$text = "Hello {$name},\n\nYour appointment has been cancelled.\n\nReference: {$reference}\nScan: {$scan_name}\nWas booked for: {$when}\nWhere: {$location}\n"
    . ($reason !== '' ? "Reason: {$reason}\n" : '')
    . "\nThe attached calendar file removes the event from calendars that support it. You can book a new appointment at any time from your portal:\n{$link}\n";
?>
<p>Hello <?= $e($name) ?>,</p>
<p>Your appointment has been cancelled.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Reference</td><td><?= $e($reference) ?></td></tr>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Scan</td><td><?= $e($scan_name) ?></td></tr>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Was booked for</td><td><?= $e($when) ?></td></tr>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Where</td><td><?= $e($location) ?></td></tr>
<?php if ($reason !== ''): ?>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Reason</td><td><?= $e($reason) ?></td></tr>
<?php endif; ?>
</table>
<p>The attached calendar file removes the event from calendars that support it.</p>
<p><a href="<?= $e($link) ?>" style="display:inline-block;background:#f28c28;color:#1b2a5c;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Open your portal</a></p>
