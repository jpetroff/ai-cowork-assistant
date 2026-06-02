import sys
import types

import pytest
from pydantic import ValidationError

from llamaflows.llm_factory import create_llm
from schemas import LlmProviderSettings


class FakeLlm:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


def install_fake_module(monkeypatch, module_name: str, class_name: str):
    module = types.ModuleType(module_name)
    setattr(module, class_name, FakeLlm)
    monkeypatch.setitem(sys.modules, module_name, module)


def make_provider(**overrides):
    data = {
        "provider_id": "provider-1",
        "provider_type": "ollama",
        "name": "Ollama",
        "base_url": "http://localhost:11434",
        "api_key": None,
        "model": "llama3",
        "config": {},
    }
    data.update(overrides)
    return LlmProviderSettings(**data)


def test_provider_schema_rejects_unsupported_type():
    with pytest.raises(ValidationError):
        make_provider(provider_type="unsupported")


def test_factory_constructs_ollama(monkeypatch):
    install_fake_module(monkeypatch, "llama_index.llms.ollama", "Ollama")

    llm = create_llm(
        make_provider(
            provider_type="ollama",
            config={"request_timeout": 30},
            context_window=8192,
            is_function_calling_model=True,
            thinking=True,
        ),
        callback_manager=object(),
    )

    assert llm.kwargs["model"] == "llama3"
    assert llm.kwargs["base_url"] == "http://localhost:11434"
    assert llm.kwargs["request_timeout"] == 30
    assert llm.kwargs["context_window"] == 8192
    assert llm.kwargs["thinking"] is True


def test_factory_constructs_openai_like(monkeypatch):
    install_fake_module(monkeypatch, "llama_index.llms.openai_like", "OpenAILike")

    llm = create_llm(
        make_provider(
            provider_type="openai_like",
            base_url="http://localhost:8000/v1",
            api_key=None,
            model="local-model",
            context_window=128000,
            is_chat_model=True,
            is_function_calling_model=False,
        ),
        callback_manager=object(),
    )

    assert llm.kwargs["api_base"] == "http://localhost:8000/v1"
    assert llm.kwargs["api_key"] == "fake"
    assert llm.kwargs["is_chat_model"] is True
    assert llm.kwargs["is_function_calling_model"] is False


def test_factory_constructs_openai(monkeypatch):
    install_fake_module(monkeypatch, "llama_index.llms.openai", "OpenAI")

    llm = create_llm(
        make_provider(
            provider_type="openai",
            base_url="https://api.openai.com/v1",
            api_key="sk-test",
            model="gpt-test",
            temperature=0.2,
            max_tokens=1000,
            timeout=60,
            reasoning_effort="medium",
            config={"max_retries": 2},
        ),
        callback_manager=object(),
    )

    assert llm.kwargs["api_base"] == "https://api.openai.com/v1"
    assert llm.kwargs["api_key"] == "sk-test"
    assert llm.kwargs["reasoning_effort"] == "medium"
    assert llm.kwargs["max_retries"] == 2


def test_factory_constructs_anthropic(monkeypatch):
    install_fake_module(monkeypatch, "llama_index.llms.anthropic", "Anthropic")

    thinking_dict = {"type": "enabled", "budget_tokens": 1024}
    llm = create_llm(
        make_provider(
            provider_type="anthropic",
            base_url="https://api.anthropic.com",
            api_key="sk-ant-test",
            model="claude-test",
            timeout=60,
            config={"max_retries": 2, "thinking_dict": thinking_dict},
        ),
        callback_manager=object(),
    )

    assert llm.kwargs["base_url"] == "https://api.anthropic.com"
    assert llm.kwargs["api_key"] == "sk-ant-test"
    assert llm.kwargs["thinking_dict"] == thinking_dict
    assert llm.kwargs["max_retries"] == 2
