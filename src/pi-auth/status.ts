import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function safeReadJson(path: string): any | null {
  try {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, 'utf-8')
    if (!raw.trim()) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function getPiAgentDir(): string {
  // oh-my-pi uses OMP_CODING_AGENT_DIR; fall back to legacy PI_CODING_AGENT_DIR.
  const envDir = process.env.OMP_CODING_AGENT_DIR ?? process.env.PI_CODING_AGENT_DIR
  if (envDir) {
    if (envDir === '~') return homedir()
    if (envDir.startsWith('~/')) return homedir() + envDir.slice(1)
    return envDir
  }
  return join(homedir(), '.omp', 'agent')
}

export function hasAnyPiAuthConfigured(): boolean {
  const agentDir = getPiAgentDir()

  // 1) agent.db present and non-zero size (oh-my-pi stores credentials in SQLite)
  const dbPath = join(agentDir, 'agent.db')
  try {
    if (existsSync(dbPath)) {
      const st = statSync(dbPath)
      if (st.size > 0) return true
    }
  } catch {
    // ignore
  }

  // 2) models.json with custom provider apiKey configured
  const modelsPath = join(agentDir, 'models.json')
  const models = safeReadJson(modelsPath)
  const providers = models?.providers
  if (providers && typeof providers === 'object') {
    for (const p of Object.values(providers as Record<string, any>)) {
      if (p && typeof p === 'object' && typeof (p as any).apiKey === 'string' && (p as any).apiKey.trim()) {
        return true
      }
    }
  }

  // 3) Known provider env vars (mirrors pi-ai getEnvApiKey mapping)
  const envVars = [
    'OPENAI_API_KEY',
    'AZURE_OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'GROQ_API_KEY',
    'CEREBRAS_API_KEY',
    'XAI_API_KEY',
    'OPENROUTER_API_KEY',
    'AI_GATEWAY_API_KEY',
    'ZAI_API_KEY',
    'MISTRAL_API_KEY',
    'MINIMAX_API_KEY',
    'MINIMAX_CN_API_KEY',
    'HF_TOKEN',
    'OPENCODE_API_KEY',
    'KIMI_API_KEY',
    // Copilot/github
    'COPILOT_GITHUB_TOKEN',
    'GH_TOKEN',
    'GITHUB_TOKEN',
    // Anthropic oauth
    'ANTHROPIC_OAUTH_TOKEN',
    'ANTHROPIC_API_KEY'
  ]

  for (const k of envVars) {
    const v = process.env[k]
    if (typeof v === 'string' && v.trim()) return true
  }

  return false
}
