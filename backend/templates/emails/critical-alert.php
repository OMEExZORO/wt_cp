<?php

declare(strict_types=1);

$subject = 'Action needed: an important finding in a report from ' . $clinic_name;
$text = "Hello {$name},\n\n{$intro}\n\nScan: {$scan_name}\nReference: {$reference}\n\nPlease sign in to your portal and acknowledge this alert, then contact the centre as soon as possible:\n{$link}\n\nFor your privacy, the finding itself is not included in this email.\n";
?>
<p>Hello <?= $e($name) ?>,</p>
<p><strong><?= $e($intro) ?></strong></p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Scan</td><td><?= $e($scan_name) ?></td></tr>
<tr><td style="padding:2px 12px 2px 0;font-weight:bold;">Reference</td><td><?= $e($reference) ?></td></tr>
</table>
<p>Please sign in to your portal and acknowledge this alert, then contact the centre as soon as possible.</p>
<p><a href="<?= $e($link) ?>" style="display:inline-block;background:#f28c28;color:#1b2a5c;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Sign in and acknowledge</a></p>
<p style="font-size:13px;color:#3a3f4b;">For your privacy, the finding itself is not included in this email.</p>
