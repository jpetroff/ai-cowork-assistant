import { useLlmProviderStore } from '@/components/projects/llmProviderStore'
import { useProjectSettingsStore } from '@/components/projects/projectSettingsStore'
import {
  getProviderType,
  parseProviderConfig,
} from '@/components/settings/providerConfig'
import type { ChatCompletionRequest } from './sidecarStore'

export function resolveLlmProviderSettings(
  projectId: string | null
): ChatCompletionRequest['llm_provider'] {
  const providers = useLlmProviderStore.getState().providers
  const projectConfig = projectId
    ? useProjectSettingsStore.getState().aiConfigs[projectId]
    : undefined
  const projectProvider = projectConfig?.provider_id
    ? providers.find((provider) => provider.id === projectConfig.provider_id)
    : undefined
  const provider =
    projectProvider ?? providers.find((candidate) => candidate.is_default === 1)

  if (!provider) {
    throw new Error('Configure an AI provider in Settings before chatting.')
  }

  const model = projectConfig?.model || provider.default_model
  if (!model) {
    throw new Error(
      'Select a model in Project AI Configuration or set a provider default model in Settings.'
    )
  }

  const config = parseProviderConfig(provider.config_json)

  return {
    provider_id: provider.id,
    provider_type: getProviderType(provider),
    name: provider.name,
    base_url: provider.base_url,
    api_key: provider.api_key,
    model,
    temperature: config.temperature ?? null,
    max_tokens: config.max_tokens ?? null,
    timeout: config.timeout ?? config.request_timeout ?? null,
    context_window: config.context_window ?? null,
    is_chat_model: config.is_chat_model ?? null,
    is_function_calling_model: config.is_function_calling_model ?? null,
    thinking: config.thinking ?? null,
    reasoning_effort: config.reasoning_effort ?? null,
    config: { ...config },
  }
}
