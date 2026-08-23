/* The MCP server.
 *
 * Streamable HTTP, and no authentication. Everything exposed is either public
 * documentation or a pure function over input the caller supplied, so there is
 * nothing here an API key would be protecting — a key would only add a step
 * between an agent and a contract we want it to read.
 *
 * Stateless mode (`sessionIdGenerator: undefined`) rather than session mode,
 * because the tools genuinely hold no per-client state: a restart between two
 * identical calls has to return the same answer, and the simplest way to
 * guarantee that is to have nothing to lose.
 *
 * Built on the low-level Server rather than McpServer so the tools can declare
 * plain JSON Schema. McpServer wants Zod shapes, which would mean maintaining
 * the schemas twice — once for the SDK and once for anything else that reads
 * them.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { TOOL_DEFINITIONS } from './tools/index.mjs'

export function createMcpServer({ previews, baseUrl, version }) {
  const server = new Server(
    { name: 'largen', version },
    { capabilities: { tools: {} } },
  )

  const handlers = new Map(
    TOOL_DEFINITIONS.map((t) => [t.name, t.handler({ previews, baseUrl })]),
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS.map(({ name, title, description, inputSchema }) => ({
      name, title, description, inputSchema,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const handler = handlers.get(request.params.name)
    if (!handler) {
      return {
        isError: true,
        content: [{ type: 'text', text: `unknown tool ${JSON.stringify(request.params.name)}` }],
      }
    }
    return handler(request.params.arguments ?? {})
  })

  return server
}

/** One transport per request. In stateless mode this is the documented shape:
 *  there is no session to keep alive between calls.
 *
 *  `enableJsonResponse` makes a POST answer with plain application/json instead
 *  of a one-event SSE stream. Nothing here streams — every tool returns a single
 *  complete result — so the SSE framing bought nothing and cost compatibility
 *  with any intermediary that buffers or serialises streamed responses.
 */
export async function handleMcpRequest(req, res, body, ctx) {
  const server = createMcpServer(ctx)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  res.on('close', () => { transport.close(); server.close() })

  await server.connect(transport)
  await transport.handleRequest(req, res, body)
}
