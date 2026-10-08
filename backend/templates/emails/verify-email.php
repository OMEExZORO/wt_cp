<?php

declare(strict_types=1);

$subject = 'Verify your email address';
$text = "Hello {$name},\n\nPlease confirm your email address for your {$clinic_name} account by opening this link:\n\n{$link}\n\nThe link expires in {$hours} hours. If you did not create an account, you can ignore this email.\n";
?>
<p>Hello <?= $e($name) ?>,</p>
<p>Please confirm your email address for your <?= $e($clinic_name) ?> account.</p>
<p><a href="<?= $e($link) ?>" style="display:inline-block;background:#f28c28;color:#1b2a5c;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Verify email address</a></p>
<p>Or copy this link into your browser:<br><span style="word-break:break-all;"><?= $e($link) ?></span></p>
<p>The link expires in <?= $e($hours) ?> hours. If you did not create an account, you can ignore this email.</p>
