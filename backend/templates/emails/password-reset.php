<?php

declare(strict_types=1);

$subject = 'Reset your password';
$text = "Hello {$name},\n\nWe received a request to reset the password for your {$clinic_name} account. Open this link to choose a new password:\n\n{$link}\n\nThe link expires in {$minutes} minutes and can be used once. If you did not ask for this, you can ignore this email; your password will not change.\n";
?>
<p>Hello <?= $e($name) ?>,</p>
<p>We received a request to reset the password for your <?= $e($clinic_name) ?> account.</p>
<p><a href="<?= $e($link) ?>" style="display:inline-block;background:#f28c28;color:#1b2a5c;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Choose a new password</a></p>
<p>Or copy this link into your browser:<br><span style="word-break:break-all;"><?= $e($link) ?></span></p>
<p>The link expires in <?= $e($minutes) ?> minutes and can be used once. If you did not ask for this, you can ignore this email; your password will not change.</p>
