export const DEFAULT_MINDMAP_API_BASE = '/api/mindmap'
export const MINDMAP_API_STORAGE_KEY = 'agentic-mindmap/api-base'

export type MindmapApiConfig = {
  apiBase: string
  source: 'query' | 'storage' | 'default'
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '')
}

export function normalizeMindmapApiBase(value: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    return DEFAULT_MINDMAP_API_BASE
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const url = new URL(trimmed)
    const normalizedPath = trimTrailingSlash(url.pathname)

    url.pathname = normalizedPath.endsWith('/api/mindmap')
      ? normalizedPath || '/api/mindmap'
      : `${normalizedPath || ''}/api/mindmap`
    url.search = ''
    url.hash = ''

    return trimTrailingSlash(url.toString())
  }

  const normalizedPath = trimTrailingSlash(trimmed)

  if (normalizedPath.endsWith('/api/mindmap')) {
    return normalizedPath
  }

  return `${normalizedPath}/api/mindmap`
}

function readStoredApiBase(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(MINDMAP_API_STORAGE_KEY)
}

export function syncMindmapApiBaseOverride(search?: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(search ?? window.location.search)
  const queryValue = params.get('mindmapApi')

  if (!queryValue) {
    return null
  }

  try {
    const normalized = normalizeMindmapApiBase(queryValue)
    window.localStorage.setItem(MINDMAP_API_STORAGE_KEY, normalized)
    return normalized
  } catch {
    return null
  }
}

export function clearStoredMindmapApiBase() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(MINDMAP_API_STORAGE_KEY)
}

export function resolveMindmapApiConfig(input?: {
  search?: string
  storedValue?: string | null
}): MindmapApiConfig {
  const search = input?.search ?? globalThis.location?.search ?? ''
  const storedValue =
    input && 'storedValue' in input ? input.storedValue : readStoredApiBase()
  const params = new URLSearchParams(search)
  const queryValue = params.get('mindmapApi')

  for (const [source, candidate] of [
    ['query', queryValue],
    ['storage', storedValue],
  ] as const) {
    if (!candidate) {
      continue
    }

    try {
      return {
        apiBase: normalizeMindmapApiBase(candidate),
        source,
      }
    } catch {
      continue
    }
  }

  return {
    apiBase: DEFAULT_MINDMAP_API_BASE,
    source: 'default',
  }
}

export function resolveMindmapApiBase(input?: {
  search?: string
  storedValue?: string | null
}): string {
  return resolveMindmapApiConfig(input).apiBase
}
