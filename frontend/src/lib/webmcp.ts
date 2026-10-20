/**
 * WebMCP (https://webmachinelearning.github.io/webmcp/): lets an AI agent in
 * the browser call tools the page provides. The spec puts the API on
 * `document.modelContext` and unregisters through an AbortSignal; earlier
 * browser previews used `navigator.modelContext` with `unregisterTool()` or a
 * handle with `unregister()`. This supports all of them and does nothing where
 * there is no agent.
 */

export interface WebMcpTool {
  /** ASCII letters, digits, `_`, `-` and `.` */
  name: string
  title?: string
  description: string
  /** JSON Schema of the input object */
  inputSchema: object
  annotations?: { readOnlyHint?: boolean; consequentialHint?: boolean }
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

interface ModelContextLike {
  registerTool(tool: object, options?: { signal?: AbortSignal }): unknown
  unregisterTool?(name: string): void
}

function modelContext(): ModelContextLike | null {
  const doc = document as { modelContext?: ModelContextLike }
  const nav = navigator as { modelContext?: ModelContextLike }
  return doc.modelContext ?? nav.modelContext ?? null
}

/** What the agent gets back: MCP-style text content, which is also plain JSON. */
function result(value: unknown, isError = false) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return { content: [{ type: 'text', text }], ...(isError && { isError: true }) }
}

/** Registers the tools; returns a function that unregisters them again. */
export function registerTools(tools: WebMcpTool[]): () => void {
  const context = modelContext()
  if (!context) return () => {}
  const controller = new AbortController()
  const handles: unknown[] = []

  for (const tool of tools) {
    const wrapped = {
      ...tool,
      execute: async (input: Record<string, unknown> | undefined) => {
        try {
          return result(await tool.execute(input ?? {}))
        } catch (error) {
          return result(error instanceof Error ? error.message : String(error), true)
        }
      },
    }
    try {
      const handle = context.registerTool(wrapped, { signal: controller.signal })
      if (handle instanceof Promise) handle.catch((e) => console.warn('WebMCP:', e))
      handles.push(handle)
    } catch (error) {
      console.warn(`WebMCP: could not register ${tool.name}`, error)
    }
  }

  return () => {
    controller.abort()
    tools.forEach((tool, index) => {
      const handle = handles[index] as { unregister?: () => void } | undefined
      try {
        if (typeof handle?.unregister === 'function') handle.unregister()
        else context.unregisterTool?.(tool.name)
      } catch {
        // Already gone through the abort signal
      }
    })
  }
}
