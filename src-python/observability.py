import logging
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)

_observability_initialized: bool = False


def setup_observability(enabled: Optional[bool] = None) -> bool:
    global _observability_initialized

    if _observability_initialized:
        return True

    should_enable = enabled if enabled is not None else settings.observability_enabled

    if not should_enable:
        logger.debug("Observability disabled")
        return False

    try:
        from phoenix.otel import register
        from openinference.instrumentation.llama_index import LlamaIndexInstrumentor

        tracer_provider = register(endpoint=settings.phoenix_endpoint)
        LlamaIndexInstrumentor().instrument(tracer_provider=tracer_provider)
        _observability_initialized = True
        logger.info(f"Phoenix observability initialized at {settings.phoenix_endpoint}")
        return True
    except ImportError as e:
        logger.warning(
            f"Phoenix dependencies not installed. Observability disabled. Missing: {e}"
        )
        return False
    except Exception as e:
        logger.warning(f"Failed to initialize Phoenix observability: {e}")
        return False


def is_observability_initialized() -> bool:
    return _observability_initialized
