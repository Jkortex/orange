import { z } from 'zod'

export const SystemFlowNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['default', 'client', 'gateway', 'service', 'cache', 'database', 'queue']).default('default'),
  x: z.number().default(0),
  y: z.number().default(0),
  description: z.string().optional(),
})

export const SystemFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  animated: z.boolean().default(false),
})

export const SystemFlowStepSchema = z.object({
  step: z.number(),
  title: z.string(),
  description: z.string().optional(),
  activeNodes: z.array(z.string()).default([]),
  activeEdges: z.array(z.string()).default([]),
  nodeStatus: z
    .record(z.string(), z.enum(['normal', 'active', 'warning', 'error', 'success']))
    .optional(),
})

export const SystemFlowConfigSchema = z.object({
  title: z.string().optional(),
  height: z.number().positive().default(420),
  nodes: z.array(SystemFlowNodeSchema).default([]),
  edges: z.array(SystemFlowEdgeSchema).default([]),
  steps: z.array(SystemFlowStepSchema).optional(),
})

export type SystemFlowNode = z.infer<typeof SystemFlowNodeSchema>
export type SystemFlowEdge = z.infer<typeof SystemFlowEdgeSchema>
export type SystemFlowStep = z.infer<typeof SystemFlowStepSchema>
export type SystemFlowConfig = z.infer<typeof SystemFlowConfigSchema>
export type SystemFlowInput = z.input<typeof SystemFlowConfigSchema>

export type ParseResult =
  | { success: true; data: SystemFlowConfig }
  | { success: false; error: string }

export function parseSystemFlowConfig(raw: unknown): ParseResult {
  let parsedJson = raw

  if (typeof raw === 'string') {
    try {
      parsedJson = JSON.parse(raw)
    } catch (e) {
      return {
        success: false,
        error: `JSON 语法解析失败: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  }

  const result = SystemFlowConfigSchema.safeParse(parsedJson)
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; '),
    }
  }

  return {
    success: true,
    data: result.data,
  }
}
