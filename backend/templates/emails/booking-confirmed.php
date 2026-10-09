<?php

declare(strict_types=1);

$subject = 'Appointment confirmed: ' . $scan_name . ' (' . $reference . ')';
$text = "Hello {$name},\n\nYour appointment is confirmed.\n\nReference: {$reference}\nScan: {$scan_name}\nWhen: {$when}\nWhere: {$location}\n\n"
    . ($preparation !== '' ? "How to prepare:\n{$preparation}\n\n" : '')
    . "Please bring your doctor's referral, any previous reports, a list of your current medicines and a photo ID.\n\n"
    . "A calendar file (.ics) is attached. You can view, reschedule or cancel this appointment here:\n{$link}\n\n"
    . "If you answered yes or unsure to any safety question, our staff will review it and may contact you before your visit.\n";
?>
<p>Hello <?= $e($name) ?>,</p>
<p>Your appointment is confirmed.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Reference</td><td><?= $e($reference) ?></td></tr>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Scan</td><td><?= $e($scan_name) ?></td></tr>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">When</td><td><?= $e($when) ?></td></tr>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Where</td><td><?= $e($location) ?></td></tr>
</table>
<?php if ($preparation !== ''): ?>
<p style="font-weight:bold;margin-bottom:4px;">How to prepare</p>
<p style="margin-top:0;"><?= $e($preparation) ?></p>
<?php endif; ?>
<p>Please bring your doctor's referral, any previous reports, a list of your current medicines and a photo ID.</p>
<p>A calendar file (.ics) is attached to this email.</p>
<p><a href="<?= $e($link) ?>" style="display:inline-block;background:#f28c28;color:#1b2a5c;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">View or manage appointment</a></p>
<p>If you answered yes or unsure to any safety question, our staff will review it and may contact you before your visit.</p>
