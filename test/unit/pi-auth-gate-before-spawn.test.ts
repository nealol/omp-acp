import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PiAcpAgent } from '../../src/acp/agent.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'

class FakeSessions {
  async create() {
    throw new Error('omp should not be spawned when no auth is configured')
  }
}

test('PiAcpAgent: newSession returns AUTH_REQUIRED without spawning omp when no auth configured', async () => {
  const prev = process.env.OMP_CODING_AGENT_DIR
  const prevLegacy = process.env.PI_CODING_AGENT_DIR
  const dir = mkdtempSync(join(tmpdir(), 'omp-acp-auth-'))

  // Create empty models file in a temp agent dir (no agent.db).
  writeFileSync(join(dir, 'models.json'), '{}', 'utf-8')

  // Also ensure typical env vars are not set for this test.
  const savedEnv: Record<string, string | undefined> = {}
  const keys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN', 'COPILOT_GITHUB_TOKEN']
  for (const k of keys) {
    savedEnv[k] = process.env[k]
    delete process.env[k]
  }

  process.env.OMP_CODING_AGENT_DIR = dir
  delete process.env.PI_CODING_AGENT_DIR

  try {
    const conn = new FakeAgentSideConnection()
    const agent = new PiAcpAgent(asAgentConn(conn), {} as any)
    ;(agent as any).sessions = new FakeSessions() as any

    await assert.rejects(
      () => agent.newSession({ cwd: process.cwd(), mcpServers: [] } as any),
      (e: any) => e?.code === -32000
    )
  } finally {
    if (prev == null) delete process.env.OMP_CODING_AGENT_DIR
    else process.env.OMP_CODING_AGENT_DIR = prev

    if (prevLegacy == null) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = prevLegacy

    for (const k of keys) {
      if (savedEnv[k] == null) delete process.env[k]
      else process.env[k] = savedEnv[k]
    }
  }
})
