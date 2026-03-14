import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MINDMAP_API_STORAGE_KEY } from './api-config'
import { createRemoteSession, loadRemoteSession } from './session-client'

describe('mindmap session client', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to the same-origin api when a stored external daemon endpoint is unreachable', async () => {
    window.localStorage.setItem(
      MINDMAP_API_STORAGE_KEY,
      'http://127.0.0.1:3210/api/mindmap',
    )

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: {
              id: 'sess_local',
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
      )

    vi.stubGlobal('fetch', fetchMock)

    const session = await createRemoteSession()

    expect(session.id).toBe('sess_local')
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3210/api/mindmap/session',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/mindmap/session',
      expect.any(Object),
    )
    expect(window.localStorage.getItem(MINDMAP_API_STORAGE_KEY)).toBeNull()
  })

  it('falls back to the same-origin api when a stored external daemon returns 404', async () => {
    window.localStorage.setItem(
      MINDMAP_API_STORAGE_KEY,
      'http://127.0.0.1:3210/api/mindmap',
    )

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'Not found',
          }),
          {
            status: 404,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: {
              id: 'sess_local',
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
      )

    vi.stubGlobal('fetch', fetchMock)

    const session = await createRemoteSession()

    expect(session.id).toBe('sess_local')
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3210/api/mindmap/session',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/mindmap/session',
      expect.any(Object),
    )
    expect(window.localStorage.getItem(MINDMAP_API_STORAGE_KEY)).toBeNull()
  })

  it('does not fall back for a stored daemon session-level 404 response', async () => {
    window.localStorage.setItem(
      MINDMAP_API_STORAGE_KEY,
      'http://127.0.0.1:3210/api/mindmap',
    )

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'Session not found',
        }),
        {
          status: 404,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    )

    vi.stubGlobal('fetch', fetchMock)

    await expect(loadRemoteSession('sess_missing')).rejects.toThrow(
      'Session not found',
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3210/api/mindmap/session/sess_missing',
      expect.any(Object),
    )
    expect(
      window.localStorage.getItem(MINDMAP_API_STORAGE_KEY),
    ).toBe('http://127.0.0.1:3210/api/mindmap')
  })

  it('falls back when a stored external daemon returns a non-json error page', async () => {
    window.localStorage.setItem(
      MINDMAP_API_STORAGE_KEY,
      'http://127.0.0.1:3210/api/mindmap',
    )

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<html>Not found</html>', {
          status: 404,
          headers: {
            'content-type': 'text/html',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session: {
              id: 'sess_local',
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        ),
      )

    vi.stubGlobal('fetch', fetchMock)

    const session = await createRemoteSession()

    expect(session.id).toBe('sess_local')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(window.localStorage.getItem(MINDMAP_API_STORAGE_KEY)).toBeNull()
  })
})
