# omp-acp

ACP ([Agent Client Protocol](https://agentclientprotocol.com/overview/introduction)) adapter for [`oh-my-pi`](https://github.com/oh-my-pi/oh-my-pi) coding agent (`@oh-my-pi/pi-coding-agent`).

`omp-acp` communicates **ACP JSON-RPC 2.0 over stdio** to an ACP client (e.g. Zed editor) and spawns `omp --mode rpc`, bridging requests/events between the two.

## Status

This is an MVP-style adapter intended to be useful today and easy to iterate on. Some ACP features may be not implemented or are not supported (see [Limitations](#limitations)). Development is centered around [Zed](https://zed.dev) editor support, other clients may have varying levels of compatibility.

Expect some minor breaking changes.

## Features

- Streams assistant output as ACP `agent_message_chunk`
- Maps omp tool execution to ACP `tool_call` / `tool_call_update`
  - For `edit`, `omp-acp` snapshots the file before the tool runs and emits an ACP **structured diff** (`oldText`/`newText`) on completion when possible
- Session persistence
  - omp stores its own sessions in `~/.omp/agent/sessions/...`
  - `omp-acp` stores a small mapping file at `~/.omp/omp-acp/session-map.json` so `session/load` can reattach to a previous omp session file
- Slash commands
  - Loads file-based slash commands compatible with omp's conventions
  - Adds a small set of built-in commands for headless/editor usage
  - Supports skill commands (if enabled in omp settings, they appear as `/skill:skill-name` in the ACP client)
- Skills are loaded by omp directly and are available in ACP sessions
- (Zed) `omp-acp` emits "startup info" block into the session (omp version, context, skills, prompts, extensions - similar to `omp` in the terminal). You can disable it by setting `quietStartup: true` in omp settings (`~/.omp/agent/settings.json` or `<project>/.omp/settings.json`). When `quietStartup` is enabled, `omp-acp` will still emit a 'New version available' message if the installed omp version is outdated.
- (Zed) Session history is supported in Zed starting with [`v0.225.0`](https://zed.dev/releases/preview/0.225.0). Session loading / history maps to omp's session files. Sessions can be resumed both in `omp` and in the ACP client.

## Prerequisites

Make sure oh-my-pi is installed

```bash
bun install -g @oh-my-pi/pi-coding-agent
```

- Bun 1.3.7+
- `omp` installed and available on your `PATH` (the adapter runs the `omp` executable)
- Configure `omp` separately for your model providers/API keys

## Install

### Add omp-acp to your ACP client, e.g. [Zed](https://zed.dev/docs/agents/external-agents/)

#### Using with `npx` (no global install needed, always loads the latest version):

Add the following to your Zed `settings.json`:

```json
  "agent_servers": {
    "omp": {
      "type": "custom",
      "command": "npx",
      "args": ["-y", "omp-acp"],
      "env": {}
    }
  }
```

#### Global install

```bash
npm install -g omp-acp
```

```json
  "agent_servers": {
    "omp": {
      "type": "custom",
      "command": "omp-acp",
      "args": [],
      "env": {}
    }
  }
```

#### From source

```bash
npm install
npm run build
```

Point your ACP client to the built `dist/index.js`:

```json
  "agent_servers": {
    "omp": {
      "type": "custom",
      "command": "node",
      "args": ["/path/to/omp-acp/dist/index.js"],
      "env": {}
    }
  }
```

### Slash commands

`omp-acp` supports slash commands:

#### 1) File-based commands (aka prompts)

Loaded from:

- User commands: `~/.omp/agent/prompts/**/*.md`
- Project commands: `<cwd>/.omp/prompts/**/*.md`

#### 2) Built-in commands

- `/compact [instructions...]` – run omp compaction (optionally with custom instructions)
- `/autocompact on|off|toggle` – toggle automatic compaction
- `/export` – export the current session to HTML in the session `cwd`
- `/session` – show session stats (tokens/messages/cost/session file)
- `/name <name>` – set session display name
- `/queue all|one-at-a-time` – set omp queue mode (unstable feature)
- `/changelog` – print the installed omp changelog (best-effort)
- `/steering` - maps to `omp` Steering Mode, get/set
- `/follow-up` - maps to `omp` Follow-up Mode, get/set

Other built-in commands:

- `/model` - maps to model selector in Zed
- `/thinking` - maps to 'mode' selector in Zed
- `/clear` - not implemented (use ACP client 'new' command)

#### 3) Skill commands

- Skill commands can be enabled in omp settings and will appear in the slash command list in ACP client as `/skill:skill-name`.

**Note**: Slash commands provided by omp extensions are not currently supported.

## Authentication (ACP Registry support)

This agent supports **Terminal Auth** for the [ACP Registry](https://agentclientprotocol.com/get-started/registry).
In Zed, this will show an **Authenticate** banner that launches omp in a terminal.
Launch omp in a terminal for interactive login/setup:

```bash
omp-acp --terminal-login
```

Your ACP client can also invoke this automatically based on the agent's advertised `authMethods`.

## Development

```bash
npm install
npm run dev        # run from src via tsx
npm run build
npm run lint
npm run test
```

Project layout:

- `src/acp/*` – ACP server + translation layer
- `src/pi-rpc/*` – omp subprocess wrapper (RPC protocol)

## Limitations

- No ACP filesystem delegation (`fs/*`) and no ACP terminal delegation (`terminal/*`). omp reads/writes and executes locally.
- MCP servers are accepted in ACP params and stored in session state, but not wired through to omp. If you use an MCP adapter it will be available in the ACP client.
- Assistant streaming is currently sent as `agent_message_chunk` (no separate thought stream).
- Queue is implemented client-side and should work like omp's `one-at-a-time`

## License

MIT (see [LICENSE](LICENSE)).
