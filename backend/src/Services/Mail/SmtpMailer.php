<?php

declare(strict_types=1);

namespace App\Services\Mail;

use PHPMailer\PHPMailer\Exception as MailerException;
use PHPMailer\PHPMailer\PHPMailer;

final class SmtpMailer implements Mailer
{
    public function __construct(private readonly array $config)
    {
    }

    public function send(MailMessage $message): void
    {
        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = (string) $this->config['smtp_host'];
            $mail->Port = (int) $this->config['smtp_port'];
            $mail->SMTPAuth = ($this->config['smtp_user'] ?? '') !== '';
            $mail->Username = (string) ($this->config['smtp_user'] ?? '');
            $mail->Password = (string) ($this->config['smtp_pass'] ?? '');
            $encryption = strtolower((string) ($this->config['smtp_encryption'] ?? 'tls'));
            $mail->SMTPSecure = match ($encryption) {
                'ssl', 'smtps' => PHPMailer::ENCRYPTION_SMTPS,
                'none', '' => '',
                default => PHPMailer::ENCRYPTION_STARTTLS,
            };
            $mail->CharSet = PHPMailer::CHARSET_UTF8;
            $mail->setFrom((string) $this->config['from'], (string) ($this->config['from_name'] ?? ''));
            $mail->addAddress($message->to, $message->toName);
            $mail->Subject = $message->subject;
            $mail->isHTML(true);
            $mail->Body = $message->html;
            $mail->AltBody = $message->text;
            foreach ($message->attachments as $attachment) {
                $mail->addStringAttachment($attachment['content'], $attachment['name'], PHPMailer::ENCODING_BASE64, $attachment['type'] ?? '');
            }
            $mail->send();
        } catch (MailerException $e) {
            throw new \RuntimeException('Email delivery failed: ' . $mail->ErrorInfo, 0, $e);
        }
    }
}
