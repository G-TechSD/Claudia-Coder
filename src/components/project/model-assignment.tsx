"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Plus,
  Trash2,
  GripVertical,
  Server,
  Cloud,
  Cpu,
  Zap,
  Brain,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2
} from "lucide-react"
import {
  AI_PROVIDERS,
  TASK_TYPES,
  type AIProvider,
  type ProviderName
} from "@/lib/ai/providers"
import {
  type ProjectModelConfig,
  type AssignedModel,
  createDefaultModelConfig,
  addModelToProject,
  removeModelFromProject,
  toggleModel,
  setTaskOverride,
  removeTaskOverride,
  getProjectModelConfig,
  saveProjectModelConfig
} from "@/lib/ai/project-models"

interface ModelAssignmentProps {
  projectId: string
  onConfigChange?: (config: ProjectModelConfig) => void
}

export function ModelAssignment({ projectId, onConfigChange }: ModelAssignmentProps) {
  const [config, setConfig] = useState<ProjectModelConfig>(() =>
    getProjectModelConfig(projectId) || createDefaultModelConfig(projectId)
  )
  const [showAddModel, setShowAddModel] = useState(false)
  const [expandedOverrides, setExpandedOverrides] = useState(false)

  // Persist changes
  useEffect(() => {
    saveProjectModelConfig(config)
    onConfigChange?.(config)
  }, [config, onConfigChange])

  const handleAddModel = (provider: ProviderName, modelId: string, name: string) => {
    const provider_info = AI_PROVIDERS.find(p => p.id === provider)
    const newConfig = addModelToProject(config, {
      modelId,
      provider,
      name,
      baseUrl: provider_info?.type === "local" ? getEnvUrl(provider) : undefined
    })
    setConfig(newConfig)
    setShowAddModel(false)
  }

  const handleRemoveModel = (assignedModelId: string) => {
    setConfig(removeModelFromProject(config, assignedModelId))
  }

  const handleToggleModel = (assignedModelId: string) => {
    setConfig(toggleModel(config, assignedModelId))
  }

  const handleSetOverride = (taskType: string, modelId: string) => {
    if (modelId === "auto") {
      setConfig(removeTaskOverride(config, taskType))
    } else {
      setConfig(setTaskOverride(config, taskType, modelId))
    }
  }

  const localProviders = AI_PROVIDERS.filter(p => p.type === "local")
  const cloudProviders = AI_PROVIDERS.filter(p => p.type === "cloud")

  return (
    <div className="space-y-6">
      {/* Assigned Models */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Assigned AI Models
              </CardTitle>
              <CardDescription>
                Models available for this project (drag to reorder priority)
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddModel(!showAddModel)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Model
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.assignedModels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
              <Cpu className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No models assigned yet</p>
              <p className="text-xs">Add models to enable AI features for this project</p>
            </div>
          ) : (
            <div className="space-y-2">
              {config.assignedModels
                .sort((a, b) => a.priority - b.priority)
                .map((model, index) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    index={index}
                    onToggle={() => handleToggleModel(model.id)}
                    onRemove={() => handleRemoveModel(model.id)}
                  />
                ))}
            </div>
          )}

          {/* Add Model Panel */}
          {showAddModel && (
            <AddModelPanel
              localProviders={localProviders}
              cloudProviders={cloudProviders}
              existingModels={config.assignedModels}
              onAdd={handleAddModel}
              onCancel={() => setShowAddModel(false)}
            />
          )}
        </CardContent>
      </Card>

      {/* Routing Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Routing Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-route by task type</Label>
              <p className="text-xs text-muted-foreground">
                Automatically select best model for each task
              </p>
            </div>
            <Switch
              checked={config.autoRoute}
              onCheckedChange={(checked) =>
                setConfig({ ...config, autoRoute: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Prefer local models</Label>
              <p className="text-xs text-muted-foreground">
                Always try local models before paid APIs
              </p>
            </div>
            <Switch
              checked={config.preferLocal}
              onCheckedChange={(checked) =>
                setConfig({ ...config, preferLocal: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Task Overrides */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setExpandedOverrides(!expandedOverrides)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Task Overrides</CardTitle>
              <CardDescription>
                Assign specific models to task types
              </CardDescription>
            </div>
            {expandedOverrides ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </CardHeader>
        {expandedOverrides && (
          <CardContent className="space-y-3">
            {TASK_TYPES.map(taskType => {
              const override = config.taskOverrides.find(o => o.taskType === taskType.id)
              return (
                <div key={taskType.id} className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{taskType.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {taskType.description}
                    </p>
                  </div>
                  <Select
                    value={override?.modelId || "auto"}
                    onValueChange={(value) => handleSetOverride(taskType.id, value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Auto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        <span className="flex items-center gap-2">
                          <Zap className="h-3 w-3" />
                          Auto-route
                        </span>
                      </SelectItem>
                      {config.assignedModels.map(model => (
                        <SelectItem key={model.id} value={model.modelId}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

function ModelRow({
  model,
  index,
  onToggle,
  onRemove
}: {
  model: AssignedModel
  index: number
  onToggle: () => void
  onRemove: () => void
}) {
  const provider = AI_PROVIDERS.find(p => p.id === model.provider)
  const isLocal = provider?.type === "local"

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        model.enabled ? "bg-background" : "bg-muted/50 opacity-60"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

      <div className="flex items-center gap-2">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            model.enabled ? "bg-green-500" : "bg-gray-400"
          )}
        />
        <Badge variant={isLocal ? "secondary" : "outline"} className="text-xs">
          {index + 1}
        </Badge>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isLocal ? (
            <Server className="h-4 w-4 text-green-500" />
          ) : (
            <Cloud className="h-4 w-4 text-blue-500" />
          )}
          <span className="font-medium text-sm">{model.name}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {provider?.name} • {isLocal ? "Free" : "Paid"}
        </p>
      </div>

      <Switch checked={model.enabled} onCheckedChange={onToggle} />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

function AddModelPanel({
  localProviders,
  cloudProviders,
  existingModels,
  onAdd,
  onCancel
}: {
  localProviders: AIProvider[]
  cloudProviders: AIProvider[]
  existingModels: AssignedModel[]
  onAdd: (provider: ProviderName, modelId: string, name: string) => void
  onCancel: () => void
}) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderName | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)

  const provider = AI_PROVIDERS.find(p => p.id === selectedProvider)
  const existingModelIds = new Set(existingModels.map(m => m.modelId))

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Add Model</h4>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Local Providers */}
      <div>
        <Label className="text-xs text-muted-foreground uppercase">
          Local (Free)
        </Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {localProviders.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProvider(p.id)
                setSelectedModel(p.defaultModel || null)
              }}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border text-left transition-colors",
                selectedProvider === p.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent"
              )}
            >
              <Server className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cloud Providers */}
      <div>
        <Label className="text-xs text-muted-foreground uppercase">
          Cloud (Paid)
        </Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {cloudProviders.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProvider(p.id)
                setSelectedModel(null)
              }}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border text-left transition-colors",
                selectedProvider === p.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent"
              )}
            >
              <Cloud className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      {provider && provider.models.length > 0 && (
        <div>
          <Label className="text-xs text-muted-foreground uppercase">
            Select Model
          </Label>
          <div className="space-y-2 mt-2">
            {provider.models.map(model => {
              const alreadyAdded = existingModelIds.has(model.id)
              return (
                <button
                  key={model.id}
                  disabled={alreadyAdded}
                  onClick={() => setSelectedModel(model.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors",
                    selectedModel === model.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent",
                    alreadyAdded && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div>
                    <p className="font-medium text-sm">{model.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {model.quality}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {model.speed}
                      </Badge>
                      {model.costPer1kTokens && (
                        <Badge variant="outline" className="text-xs">
                          ${model.costPer1kTokens}/1k
                        </Badge>
                      )}
                    </div>
                  </div>
                  {alreadyAdded ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : selectedModel === model.id ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Local model - just needs the base URL */}
      {provider && provider.type === "local" && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Uses currently loaded model</p>
              <p className="text-xs text-muted-foreground">
                Will use whatever model is loaded in {provider.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Button */}
      <Button
        className="w-full"
        disabled={!selectedProvider || (provider?.models.length && !selectedModel)}
        onClick={() => {
          if (selectedProvider) {
            const modelId = selectedModel || `${selectedProvider}-loaded`
            const modelName = provider?.models.find(m => m.id === selectedModel)?.name
              || `${provider?.name} (loaded model)`
            onAdd(selectedProvider, modelId, modelName)
          }
        }}
      >
        Add Model
      </Button>
    </div>
  )
}

function getEnvUrl(provider: ProviderName): string | undefined {
  if (typeof window === "undefined") return undefined

  switch (provider) {
    case "lmstudio":
      return process.env.NEXT_PUBLIC_LMSTUDIO_BEAST
    case "ollama":
      return process.env.NEXT_PUBLIC_OLLAMA_URL
    default:
      return undefined
  }
}
