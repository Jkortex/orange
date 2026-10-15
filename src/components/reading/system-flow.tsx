'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Position,
  Handle,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Laptop,
  Shield,
  Server,
  Zap,
  Database,
  ListOrdered,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Network,
  AlertCircle,
} from 'lucide-react'
import { IconButton } from '@/components/primitives/icon-button'
import {
  parseSystemFlowConfig,
  type SystemFlowInput,
} from '@/lib/system-flow-schema'
import { cn } from '@/lib/utils'

export interface SystemFlowProps {
  title?: string
  rawConfig?: string
  config?: SystemFlowInput
  height?: number | string
}

interface CustomNodeData extends Record<string, unknown> {
  label: string
  nodeType?: string
  description?: string
  isActive?: boolean
  status?: 'normal' | 'active' | 'warning' | 'error' | 'success'
}

function getNodeIcon(nodeType?: string) {
  switch (nodeType) {
    case 'client':
      return Laptop
    case 'gateway':
      return Shield
    case 'service':
      return Server
    case 'cache':
      return Zap
    case 'database':
      return Database
    case 'queue':
      return ListOrdered
    default:
      return Cpu
  }
}

function SystemNodeComponent({ data }: NodeProps<Node<CustomNodeData>>) {
  const Icon = getNodeIcon(data.nodeType)
  const isError = data.status === 'error'
  const isWarning = data.status === 'warning'
  const isActive = data.isActive || isError || isWarning

  return (
    <div
      className={cn(
        'relative flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2.5 shadow-sm transition-all duration-300',
        isActive
          ? 'border-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-background'
          : 'border-border-subtle hover:border-border',
        isError && 'border-destructive bg-destructive/10 text-destructive ring-destructive/30',
        isWarning && 'border-primary text-primary',
      )}
    >
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
          isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
          isError && 'bg-destructive/20 text-destructive',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </div>

      <div className="flex flex-col text-left">
        <span className="text-xs font-semibold tracking-tight text-foreground">
          {data.label}
        </span>
        {data.description && (
          <span className="text-[10px] text-muted-foreground">{data.description}</span>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="!size-1.5 !bg-border-strong" />
      <Handle type="source" position={Position.Bottom} className="!size-1.5 !bg-border-strong" />
      <Handle type="target" position={Position.Left} className="!size-1.5 !bg-border-strong" />
      <Handle type="source" position={Position.Right} className="!size-1.5 !bg-border-strong" />
    </div>
  )
}

const nodeTypes = {
  systemNode: SystemNodeComponent,
}

export function SystemFlow({
  title: initialTitle,
  rawConfig,
  config: directConfig,
  height,
}: SystemFlowProps) {
  // 1. 配置解析与容错校验
  const parsed = useMemo(() => {
    if (directConfig) return parseSystemFlowConfig(directConfig)
    if (rawConfig) return parseSystemFlowConfig(rawConfig)
    return { success: false as const, error: '未提供流程图配置' }
  }, [directConfig, rawConfig])

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  const config = parsed.success ? parsed.data : null
  const steps = config?.steps ?? []
  const hasSteps = steps.length > 0
  const currentStep = hasSteps ? steps[currentStepIndex] : null

  // 2. 自动播放时序控制
  useEffect(() => {
    if (!isPlaying || !hasSteps) return

    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 2400)

    return () => clearInterval(timer)
  }, [isPlaying, hasSteps, steps.length])

  // 3. 计算当前步骤下的动态节点与边
  const activeNodesSet = useMemo(() => {
    return new Set(currentStep?.activeNodes ?? [])
  }, [currentStep])

  const activeEdgesSet = useMemo(() => {
    return new Set(currentStep?.activeEdges ?? [])
  }, [currentStep])

  const flowNodes: Node<CustomNodeData>[] = useMemo(() => {
    if (!config) return []
    return config.nodes.map((n) => {
      const isNodeActive = activeNodesSet.has(n.id)
      const status = currentStep?.nodeStatus?.[n.id] ?? (isNodeActive ? 'active' : 'normal')

      return {
        id: n.id,
        type: 'systemNode',
        position: { x: n.x, y: n.y },
        data: {
          label: n.label,
          nodeType: n.type,
          description: n.description,
          isActive: isNodeActive,
          status,
        },
      }
    })
  }, [config, activeNodesSet, currentStep])

  const flowEdges: Edge[] = useMemo(() => {
    if (!config) return []
    return config.edges.map((e) => {
      const isEdgeActive = activeEdgesSet.has(e.id)
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: isEdgeActive || e.animated,
        className: isEdgeActive ? 'stroke-primary stroke-2' : 'stroke-border',
        style: isEdgeActive
          ? { stroke: 'var(--color-primary)', strokeWidth: 2 }
          : { stroke: 'var(--color-border)' },
      }
    })
  }, [config, activeEdgesSet])

  const handlePrev = useCallback(() => {
    setIsPlaying(false)
    setCurrentStepIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const handleNext = useCallback(() => {
    setIsPlaying(false)
    setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1))
  }, [steps.length])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    setCurrentStepIndex(0)
  }, [])

  const togglePlay = useCallback(() => {
    if (currentStepIndex >= steps.length - 1) {
      setCurrentStepIndex(0)
    }
    setIsPlaying((p) => !p)
  }, [currentStepIndex, steps.length])

  // 4. 解析错误处理分支
  if (!parsed.success) {
    return (
      <div className="surface-card not-prose my-6 flex items-start gap-3 border border-destructive/40 p-4 text-xs text-destructive shadow-sm">
        <AlertCircle className="size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-foreground">系统流程图配置解析失败</span>
          <span className="text-muted-foreground">{parsed.error}</span>
        </div>
      </div>
    )
  }

  const validConfig = parsed.data
  const displayTitle = initialTitle || validConfig.title || '系统设计架构拓扑'
  const containerHeight = height ?? validConfig.height ?? 420

  return (
    <div className="surface-card group/systemflow not-prose my-8 overflow-hidden">
      {/* 顶栏信息与状态指示 */}
      <div className="panel-bar flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Network className="size-3.5" aria-hidden />
          </span>
          <span className="type-caption font-semibold tracking-tight text-foreground">
            {displayTitle}
          </span>
        </div>

        {hasSteps && (
          <div className="flex items-center gap-2">
            <span className="type-caption rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              步骤 {currentStepIndex + 1} / {steps.length}
            </span>
          </div>
        )}
      </div>

      {/* React Flow 画布区域 */}
      <div
        className="relative w-full bg-background/50"
        style={{ height: typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight }}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          panOnScroll={false}
          zoomOnScroll={false}
          preventScrolling={false}
          nodesDraggable={true}
          elementsSelectable={false}
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} className="!m-2 !border-border-subtle !bg-card !shadow-sm" />
        </ReactFlow>
      </div>

      {/* 底部步骤引导与控制器 */}
      {hasSteps && currentStep && (
        <div className="panel-bar flex flex-col justify-between gap-3 border-t border-border-subtle p-3 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                Step {currentStepIndex + 1}
              </span>
              <span className="text-xs font-semibold text-foreground">
                {currentStep.title}
              </span>
            </div>
            {currentStep.description && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {currentStep.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 self-end sm:self-center">
            <IconButton
              label="上一步"
              size="sm"
              disabled={currentStepIndex === 0}
              onClick={handlePrev}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </IconButton>

            <IconButton
              label={isPlaying ? '暂停演练' : '自动播放'}
              size="sm"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause className="size-4 text-primary" aria-hidden />
              ) : (
                <Play className="size-4" aria-hidden />
              )}
            </IconButton>

            <IconButton
              label="下一步"
              size="sm"
              disabled={currentStepIndex === steps.length - 1}
              onClick={handleNext}
            >
              <ChevronRight className="size-4" aria-hidden />
            </IconButton>

            <IconButton
              label="重置流程"
              size="sm"
              onClick={handleReset}
            >
              <RotateCcw className="size-4" aria-hidden />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  )
}
