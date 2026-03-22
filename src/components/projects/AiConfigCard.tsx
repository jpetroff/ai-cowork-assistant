import { useNavigate } from 'react-router-dom'
import { CpuIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { useLlmProviderStore } from '@/stores/llmProviderStore'
import { useProjectSettingsStore } from '@/stores/projectSettingsStore'
import type { ProjectAiConfig } from '@/stores/projectSettingsStore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AiConfigCardProps {
  projectId: string
}

export function AiConfigCard({ projectId }: AiConfigCardProps) {
  const navigate = useNavigate()
  const providers = useLlmProviderStore((s) => s.providers)
  const modelsByProvider = useLlmProviderStore((s) => s.modelsByProvider)
  const fetchModels = useLlmProviderStore((s) => s.fetchModels)
  const config = useProjectSettingsStore((s) => s.aiConfigs[projectId])
  const saveAiConfig = useProjectSettingsStore((s) => s.saveAiConfig)

  const hasProviders = providers.length > 0
  const models = config?.provider_id ? (modelsByProvider[config.provider_id] ?? []) : []

  const current: ProjectAiConfig = config ?? { provider_id: null, model: null, embedding_model: null }

  function patchConfig(patch: Partial<ProjectAiConfig>) {
    saveAiConfig(projectId, { ...current, ...patch })
  }

  function handleProviderChange(providerId: string | null) {
    if (!providerId) return
    patchConfig({ provider_id: providerId, model: null })
    fetchModels(providerId)
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CpuIcon className="size-3.5 text-muted-foreground" />
          AI Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!hasProviders ? (
          <>
            <p className="text-xs text-muted-foreground">
              No AI providers configured yet.
            </p>
            <Select disabled>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="LLM Provider" />
              </SelectTrigger>
              <SelectContent />
            </Select>
            <Select disabled>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent />
            </Select>
            <Select disabled>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Embedding model" />
              </SelectTrigger>
              <SelectContent />
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate('/settings')}
            >
              Configure in Settings
              <ArrowRightIcon className="size-3.5 ml-1" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Provider</label>
              <Select
                value={current.provider_id ?? undefined}
                onValueChange={handleProviderChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Model</label>
              <Select
                value={current.model ?? undefined}
                onValueChange={(model) => { if (model) patchConfig({ model }) }}
                disabled={!config?.provider_id || models.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Embedding model</label>
              <Select
                value={current.embedding_model ?? undefined}
                onValueChange={(embedding_model) => { if (embedding_model) patchConfig({ embedding_model }) }}
                disabled
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Coming soon" />
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
