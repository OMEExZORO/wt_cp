<?php

declare(strict_types=1);

$subject = 'Your password was changed';
$text = "Hello {$name},\n\nThe password for your {$clinic_name} account was changed on {$changed_at}. You have been signed out on other devices.\n\nIf you did not make this change, reset your password at {$reset_link} and contact the centre.\n";
?>
<p>Hello <?= $e($name) ?>,</p>
<p>The password for your <?= $e($clinic_name) ?> account was changed on <?= $e($changed_at) ?>. You have been signed out on other devices.</p>
<p>If you did not make this change, <a href="<?= $e($reset_link) ?>">reset your password</a> and contact the centre.</p>
