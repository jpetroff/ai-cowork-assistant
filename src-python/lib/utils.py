import datetime
import inspect
from pygments import highlight
import rich
from llama_index.core.schema import NodeWithScore
from typing import List, TypeVar

T = TypeVar("T")


def log(
    content: str,
    workflow: str = "",
    user: str = "",
    truncate: bool = True,
    next: str = "",
    **kwargs,
) -> None:
    TRUNCATE_LEN = 56
    _stack = inspect.stack()
    step_name = _stack[1][3]

    timestamp = datetime.datetime.now().strftime("%H:%M:%S · %d.%m.%y")

    _content = " ".join(
        [
            content,
            ("Next:[purple]" + next + "[/]") if next else "",
        ]
    ).strip(" ")

    _runtime_meta = " executing ".join([user, workflow]).strip(" ")

    log_str = (
        f"[dim]{timestamp.ljust(32)}[/]"
        f"[dim]{_runtime_meta}[/]"
        "\n"
        f"[yellow]{(step_name+'():').ljust(32)}[/]"
        f"{_content}"
    )
    rich.get_console().print(log_str, highlight=False, crop=True)


def format_nodes(nodes: List[NodeWithScore]) -> str:
    result: str = ""
    for idx, node in enumerate(nodes):
        result += (
            f"<reference>\n"
            f"[{idx}|{node.id_}]. {str(node.metadata)}\n"
            f"{node.get_content()}\n"
            f"</reference>\n"
        )
    return result


def last_n(list: List[T], num: int = 1) -> List[T]:
    return list[-num:] if num > 0 else []
