export function methodTone(method: string): string {
  const upper = method.toUpperCase()
  switch (upper) {
    case 'GET':
      return 'text-primary'
    case 'POST':
      return 'text-success'
    case 'PUT':
    case 'PATCH':
      return 'text-warning'
    case 'DELETE':
      return 'text-destructive'
    case 'HEAD':
    case 'OPTIONS':
      return 'text-muted-foreground'
    case 'CONNECT':
      return 'text-accent'
    default:
      return 'text-foreground'
  }
}

export function statusTone(status: number | null): string {
  if (status === null) return 'text-muted-foreground'
  if (status >= 500) return 'text-destructive'
  if (status >= 400) return 'text-warning'
  if (status >= 300) return 'text-accent'
  if (status >= 200) return 'text-success'
  return 'text-muted-foreground'
}

export function contentTypeShort(contentType: string | null | undefined): string {
  if (!contentType) return '—'
  const semi = contentType.indexOf(';')
  const main = semi >= 0 ? contentType.slice(0, semi) : contentType
  return main.trim().toLowerCase()
}
