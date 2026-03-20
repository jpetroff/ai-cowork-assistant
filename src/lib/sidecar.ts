import { invoke } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

export interface SidecarInfo {
  available: boolean
  url: string | null
  error: string | null
}

export async function initSidecar(): Promise<SidecarInfo> {
  return invoke<SidecarInfo>('init')
}

export async function fetchFromSidecar<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const info = await initSidecar()

  if (!info.available || !info.url) {
    throw new Error(info.error || 'Sidecar not available')
  }

  const response = await tauriFetch(`${info.url}${path}`, options)
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json()
}
