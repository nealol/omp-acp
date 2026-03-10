import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Storage owned by the ACP adapter.
 *
 * We intentionally keep this separate from omp's own ~/.omp/agent/* directory.
 */
export function getPiAcpDir(): string {
  return join(homedir(), '.omp', 'omp-acp')
}

export function getPiAcpSessionMapPath(): string {
  return join(getPiAcpDir(), 'session-map.json')
}
