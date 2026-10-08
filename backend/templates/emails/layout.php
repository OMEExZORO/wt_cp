<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= $e($title) ?></title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2430;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#1b2a5c;color:#ffffff;padding:20px 24px;font-size:18px;font-weight:bold;"><?= $e($clinic_name) ?></td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6;"><?= $content ?></td></tr>
<tr><td style="padding:16px 24px;background:#ece8f6;font-size:12px;line-height:1.5;color:#3a3f4b;">
This is an automated message from <?= $e($clinic_name) ?>. Please do not reply to this email.<br>
This service does not provide medical advice and is not for emergencies. In an emergency call 112.<br>
Prenatal sex determination is prohibited under the PCPNDT Act.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
