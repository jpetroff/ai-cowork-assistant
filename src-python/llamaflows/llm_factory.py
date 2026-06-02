from typing import Any

from llama_index.core.callbacks import CallbackManager

from schemas import LlmProviderSettings


def _clean_kwargs(kwargs: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in kwargs.items() if value is not None}


def _config_value(provider: LlmProviderSettings, key: str) -> Any:
    return provider.config.get(key)


def create_llm(
    provider: LlmProviderSettings,
    callback_manager: CallbackManager,
):
    provider_type = provider.provider_type

    if provider_type == "ollama":
        from llama_index.llms.ollama import Ollama

        return Ollama(
            **_clean_kwargs(
                {
                    "model": provider.model,
                    "base_url": provider.base_url,
                    "temperature": provider.temperature,
                    "context_window": provider.context_window,
                    "request_timeout": _config_value(provider, "request_timeout")
                    or provider.timeout,
                    "is_function_calling_model": provider.is_function_calling_model,
                    "thinking": provider.thinking,
                    "callback_manager": callback_manager,
                }
            )
        )

    if provider_type == "openai_like":
        from llama_index.llms.openai_like import OpenAILike

        return OpenAILike(
            **_clean_kwargs(
                {
                    "model": provider.model,
                    "api_base": provider.base_url,
                    "api_key": provider.api_key or "fake",
                    "temperature": provider.temperature,
                    "max_tokens": provider.max_tokens,
                    "timeout": provider.timeout,
                    "context_window": provider.context_window,
                    "is_chat_model": provider.is_chat_model,
                    "is_function_calling_model": provider.is_function_calling_model,
                    "callback_manager": callback_manager,
                }
            )
        )

    if provider_type == "openai":
        from llama_index.llms.openai import OpenAI

        return OpenAI(
            **_clean_kwargs(
                {
                    "model": provider.model,
                    "api_key": provider.api_key,
                    "api_base": provider.base_url,
                    "temperature": provider.temperature,
                    "max_tokens": provider.max_tokens,
                    "timeout": provider.timeout,
                    "max_retries": _config_value(provider, "max_retries"),
                    "reasoning_effort": provider.reasoning_effort,
                    "callback_manager": callback_manager,
                }
            )
        )

    if provider_type == "anthropic":
        from llama_index.llms.anthropic import Anthropic

        return Anthropic(
            **_clean_kwargs(
                {
                    "model": provider.model,
                    "api_key": provider.api_key,
                    "base_url": provider.base_url,
                    "temperature": provider.temperature,
                    "max_tokens": provider.max_tokens,
                    "timeout": provider.timeout,
                    "max_retries": _config_value(provider, "max_retries"),
                    "thinking_dict": _config_value(provider, "thinking_dict"),
                    "callback_manager": callback_manager,
                }
            )
        )

    raise ValueError(f"Unsupported provider type: {provider_type}")
