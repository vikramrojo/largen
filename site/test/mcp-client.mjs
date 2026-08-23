/* Connect to the running server as a real MCP client and call all six tools.
 *
 * This does a genuine protocol handshake rather than calling the handlers
 * directly, because "the tools work" and "the server speaks MCP" are different
 * claims and only the second one is what a caller depends on.
 *
 * Deliberately not `claude mcp add`: that mutates a developer's global config as
 * a side effect of running a test. The install command is in DEPLOY.md for a
 * human to run once.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const BASE = process.env.LARGEN_BASE_URL ?? 'http://127.0.0.1:8787'

export async function connect() {
  const client = new Client({ name: 'largen-test', version: '0.1.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/api/mcp`)))
  return client
}

export const parse = (result) => JSON.parse(result.content[0].text)

export async function callTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args })
  return { isError: result.isError ?? false, data: parse(result) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const client = await connect()
  const { tools } = await client.listTools()
  console.log(`\n  connected — ${tools.length} tools advertised\n`)
  for (const t of tools) console.log(`    ${t.name.padEnd(22)} ${t.title}`)
  console.log()
  await client.close()
}
