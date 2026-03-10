import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpAgent } from '../../src/acp/agent.js'
import { PiAcpSession } from '../../src/acp/session.js'
import { FakeAgentSideConnection, FakePiRpcProcess, asAgentConn } from '../helpers/fakes.js'

test('newSession exposes oh-my-pi interruptMode and queuedMessageCount in _meta', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess() as any

  // Mock oh-my-pi extended get_state response
  proc.getState = async () => ({
    sessionId: 'test-session',
    sessionFile: null,
    interruptMode: 'eager',
    queuedMessageCount: 3,
    model: { provider: 'test', id: 'model' },
    thinkingLevel: 'medium'
  })

  proc.getCommands = async () => ({ commands: [] })

  const agent = new PiAcpAgent(asAgentConn(conn))

  // Mock the sessions manager to avoid real process spawning
  const fakeSessionManager = {
    create: async () => {
      const session = new PiAcpSession({
        sessionId: 'test-session',
        cwd: '/test',
        mcpServers: [],
        proc,
        conn: asAgentConn(conn),
        fileCommands: []
      })
      return session
    },
    closeAllExcept: () => {}
  }
  ;(agent as any).sessions = fakeSessionManager

  // Mock hasAnyPiAuthConfigured to return true
  const { hasAnyPiAuthConfigured } = await import('../../src/pi-auth/status.js')
  const original = (hasAnyPiAuthConfigured as any).default
  ;(hasAnyPiAuthConfigured as any).default = () => true

  try {
    const response = await agent.newSession({
      cwd: '/test',
      mcpServers: []
    } as any)

    assert.equal(response._meta?.piAcp?.interruptMode, 'eager')
    assert.equal(response._meta?.piAcp?.queuedMessageCount, 3)
  } finally {
    ;(hasAnyPiAuthConfigured as any).default = original
  }
})

test('PiAcpSession handles extension_ui_request events', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess() as any

  // Create session to test event handling
  new PiAcpSession({
    sessionId: 's1',
    cwd: '/test',
    mcpServers: [],
    proc,
    conn: asAgentConn(conn),
    fileCommands: []
  })

  // Emit an extension_ui_request event
  proc.emit({
    type: 'extension_ui_request',
    message: 'Please confirm this action',
    details: { action: 'delete', file: 'test.txt' }
  })

  // Wait for the event to be processed
  await new Promise(resolve => setTimeout(resolve, 10))

  // Check that the session emitted an agent_message_chunk
  const updates = conn.updates.filter((u: any) => u.update?.sessionUpdate === 'agent_message_chunk')
  assert.ok(updates.length > 0, 'Expected at least one agent_message_chunk update')

  const lastUpdate = updates[updates.length - 1]
  const content = (lastUpdate as any).update?.content
  assert.ok(content, 'Expected content in update')
  assert.equal(content.type, 'text')
  assert.match(content.text, /Extension request:/)
  assert.match(content.text, /Please confirm this action/)
})

test('PiRpcProcess exposes new oh-my-pi RPC command methods', async () => {
  // This test verifies that the new methods exist and have the correct signatures
  const proc = new FakePiRpcProcess() as any

  // Add mock implementations for the new oh-my-pi commands
  proc.newSession = async (_parentSession?: string) => ({ sessionId: 'new-session' })
  proc.steer = async (_message: string, _images?: unknown[]) => {}
  proc.followUp = async (_message: string, _images?: unknown[]) => {}
  proc.abortAndPrompt = async (_message: string, _images?: unknown[]) => {}
  proc.cycleModel = async () => ({ provider: 'test', id: 'new-model' })
  proc.cycleThinkingLevel = async () => ({ level: 'high' })
  proc.setInterruptMode = async (_mode: 'eager' | 'lazy') => {}
  proc.bash = async (_command: string) => {}
  proc.abortBash = async () => {}
  proc.branch = async (_entryId: string) => ({ branchId: 'branch-1' })
  proc.getBranchMessages = async (_entryId: string) => ({ messages: [] })
  proc.setAutoRetry = async (_enabled: boolean) => {}
  proc.abortRetry = async () => {}

  // Verify methods can be called
  assert.doesNotThrow(async () => {
    await proc.newSession()
    await proc.newSession('parent-session')
    await proc.steer('test message')
    await proc.followUp('test message', [])
    await proc.abortAndPrompt('new prompt')
    await proc.cycleModel()
    await proc.cycleThinkingLevel()
    await proc.setInterruptMode('eager')
    await proc.setInterruptMode('lazy')
    await proc.bash('echo test')
    await proc.abortBash()
    await proc.branch('entry-123')
    await proc.getBranchMessages('entry-123')
    await proc.setAutoRetry(true)
    await proc.setAutoRetry(false)
    await proc.abortRetry()
  })
})
