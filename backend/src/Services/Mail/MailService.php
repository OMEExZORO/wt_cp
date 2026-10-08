<?php

declare(strict_types=1);

namespace App\Services\Mail;

use App\Core\Logger;
use App\Validation\Sanitizer;
use Throwable;

final class MailService
{
    public function __construct(
        private readonly Mailer $mailer,
        private readonly Logger $logger,
        private readonly string $templateDir,
        private readonly array $globals = []
    ) {
    }

    public function sendTemplate(string $to, string $toName, string $template, array $vars = []): bool
    {
        try {
            [$subject, $html, $text] = $this->render($template, $vars);
            $this->mailer->send(new MailMessage($to, $toName, $subject, $html, $text));
            return true;
        } catch (Throwable $e) {
            $this->logger->error('Email could not be sent', ['template' => $template, 'error' => $e->getMessage()]);
            return false;
        }
    }

    public function render(string $template, array $vars = []): array
    {
        if (preg_match('/^[a-z0-9-]+$/', $template) !== 1) {
            throw new \InvalidArgumentException('Invalid template name');
        }
        $file = $this->templateDir . '/' . $template . '.php';
        $layout = $this->templateDir . '/layout.php';
        if (!is_file($file)) {
            throw new \RuntimeException(sprintf('Email template %s not found', $template));
        }
        $data = array_merge($this->globals, $vars);
        $e = static fn (mixed $value): string => Sanitizer::escape(is_scalar($value) ? (string) $value : '');

        $renderFile = static function (string $__file, array $__data) use ($e): array {
            extract($__data, EXTR_SKIP);
            $subject = '';
            $text = '';
            ob_start();
            try {
                include $__file;
            } finally {
                $output = (string) ob_get_clean();
            }
            return [$subject, $output, $text];
        };

        [$subject, $content, $text] = $renderFile($file, $data);
        [, $html] = $renderFile($layout, array_merge($data, ['title' => $subject, 'content' => $content]));
        return [$subject, $html, $text];
    }
}
