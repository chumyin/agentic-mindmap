import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MINDMAP_API_BASE,
  MINDMAP_API_STORAGE_KEY,
  normalizeMindmapApiBase,
  resolveMindmapApiBase,
  syncMindmapApiBaseOverride,
} from './api-config'

describe('mindmap api config', () => {
  it('normalizes an external origin into the shared api base path', () => {
    expect(normalizeMindmapApiBase('http://127.0.0.1:3210')).toBe(
      'http://127.0.0.1:3210/api/mindmap',
    )
  })

  it('preserves an explicit api base path while trimming a trailing slash', () => {
    expect(normalizeMindmapApiBase('http://127.0.0.1:3210/api/mindmap/')).toBe(
      'http://127.0.0.1:3210/api/mindmap',
    )
  })

  it('prefers the query parameter override over stored config', () => {
    expect(
      resolveMindmapApiBase({
        search: '?mindmapApi=http%3A%2F%2F127.0.0.1%3A3210',
        storedValue: 'http://127.0.0.1:9999',
      }),
    ).toBe('http://127.0.0.1:3210/api/mindmap')
  })

  it('uses the stored api base when there is no query parameter override', () => {
    expect(
      resolveMindmapApiBase({
        search: '',
        storedValue: 'http://127.0.0.1:3210',
      }),
    ).toBe('http://127.0.0.1:3210/api/mindmap')
  })

  it('falls back to the same-origin api base when no override is configured', () => {
    expect(
      resolveMindmapApiBase({
        search: '',
        storedValue: null,
      }),
    ).toBe(DEFAULT_MINDMAP_API_BASE)
  })

  it('syncs a query parameter override into browser storage for later reloads', () => {
    const storage = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    })

    const resolved = syncMindmapApiBaseOverride(
      '?mindmapApi=http%3A%2F%2F127.0.0.1%3A3210',
    )

    expect(resolved).toBe('http://127.0.0.1:3210/api/mindmap')
    expect(storage.get(MINDMAP_API_STORAGE_KEY)).toBe(
      'http://127.0.0.1:3210/api/mindmap',
    )
  })
})
