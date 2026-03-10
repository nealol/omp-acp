import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PiAcpAgent } from '../../src/acp/agent.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'

test('PiAcpAgent: newSession returns a helpful Internal error when omp is not installed', async () => {
  const prevAgentDir = process.env.OMP_CODING_AGENT_DIR
  const prevLegacyDir = process.env.PI_CODING_AGENT_DIR
  const prevPiCmd = process.env.OMP_ACP_COMMAND
  const prevLegacyCmd = process.env.PI_ACP_PI_COMMAND

  // Ensure we pass the auth gate so the agent actually tries to spawn omp.
  const dir = mkdtempSync(join(tmpdir(), 'omp-acp-not-found-'))
  writeFileSync(join(dir, 'agent.db'), 'notempty', 'utf-8')
  writeFileSync(join(dir, 'models.json'), '{}', 'utf-8')

  process.env.OMP_CODING_AGENT_DIR = dir
  delete process.env.PI_CODING_AGENT_DIR
  process.env.OMP_ACP_COMMAND = 'omp-does-not-exist-12345'
  delete process.env.PI_ACP_PI_COMMAND

  try {
    const conn = new FakeAgentSideConnection()
    const agent = new PiAcpAgent(asAgentConn(conn), {} as any)

    await assert.rejects(
      () => agent.newSession({ cwd: process.cwd(), mcpServers: [] } as any),
      (e: any) => e?.code === -32603 && String(e?.message ?? '').toLowerCase().includes('executable not found')
    )
  } finally {
    if (prevAgentDir == null) delete process.env.OMP_CODING_AGENT_DIR
    else process.env.OMP_CODING_AGENT_DIR = prevAgentDir

    if (prevLegacyDir == null) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = prevLegacyDir

    if (prevPiCmd == null) delete process.env.OMP_ACP_COMMAND
    else process.env.OMP_ACP_COMMAND = prevPiCmd

    if (prevLegacyCmd == null) delete process.env.PI_ACP_PI_COMMAND
    else process.env.PI_ACP_PI_COMMAND = prevLegacyCmd
  }
})
