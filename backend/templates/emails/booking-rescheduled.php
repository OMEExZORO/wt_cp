<?php

declare(strict_types=1);

$subject = 'Appointment rescheduled: ' . $scan_name . ' (' . $reference . ')';
$text = "Hello {$name},\n\nYour appointment has been moved.\n\nReference: {$reference}\nScan: {$scan_name}\n"
    . ($previous_when !== '' ? "Previous time: {$previous_when}\n" : '')
    . "New time: {$when}\nWhere: {$location}\n\n"
    . ($preparation !== '' ? "How to prepare:\n{$preparation}\n\n" : '')
    . "An updated calendar file (.ics) is attached. Manage your appointment here:\n{$link}\n";
?>
<p>Hello <?= $e($name) ?>,</p>
<p>Your appointment has been moved.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Reference</td><td><?= $e($reference) ?></td></tr>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Scan</td><td><?= $e($scan_name) ?></td></tr>
<?php if ($previous_when !== ''): ?>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Previous time</td><td><s><?= $e($previous_when) ?></s></td></tr>
<?php endif; ?>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">New time</td><td><?= $e($when) ?></td></tr>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Where</td><td><?= $e($location) ?></td></tr>
</table>
<?php if ($preparation !== ''): ?>
<p style="font-weight:bold;margin-bottom:4px;">How to prepare</p>
<p style="margin-top:0;"><?= $e($preparation) ?></p>
<?php endif; ?>
<p>An updated calendar file (.ics) is attached to this email.</p>
<p><a href="<?= $e($link) ?>" style="display:inline-block;background:#f28c28;color:#1b2a5c;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">View or manage appointment</a></p>
