export const MAX_REPORT_BYTES = 10 * 1024 * 1024

export const REPORT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

const ALLOWED: Record<string, readonly string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
}

const DANGEROUS_SEGMENT = /\.(php\d?|phtml|phar|pl|py|rb|cgi|asp|aspx|jsp|exe|dll|com|bat|cmd|sh|bash|ps1|vbs|js|mjs|html?|svg|swf|jar)(\.|$)/i

export function extensionOf(name: string): string {
  const index = name.lastIndexOf('.')
  return index < 0 ? '' : name.slice(index + 1).toLowerCase()
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateReportFile(file: File | null): string | null {
  if (file === null) {
    return 'Choose a file to upload.'
  }
  if (file.size === 0) {
    return 'The file is empty.'
  }
  if (file.size > MAX_REPORT_BYTES) {
    return `The file is too large (${formatBytes(file.size)}). The limit is 10 MB.`
  }
  if (DANGEROUS_SEGMENT.test(file.name)) {
    return 'This file name is not allowed.'
  }
  const extensions = ALLOWED[file.type]
  if (extensions === undefined) {
    return 'Only PDF, JPG and PNG files are allowed.'
  }
  if (!extensions.includes(extensionOf(file.name))) {
    return 'The file extension does not match the file type.'
  }
  return null
}
