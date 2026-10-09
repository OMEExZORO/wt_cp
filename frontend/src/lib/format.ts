export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
