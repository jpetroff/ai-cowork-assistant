import logging
from pathlib import Path

from fastapi import APIRouter
from schemas import WorkflowInfo

router = APIRouter(tags=["workflows"])
logger = logging.getLogger(__name__)

WORKFLOWS_DIR = Path("./llamaflows")


def _get_workflow_description(file_path: Path) -> str:
    try:
        content = file_path.read_text(encoding="utf-8")
        for line in content.split("\n"):
            line = line.strip()
            if line.startswith('"""') or line.startswith("'''"):
                docstring_start = line[:3]
                rest = line[3:]
                if rest.endswith(docstring_start) and len(rest) > 3:
                    return rest[3:-3]
                lines = [rest]
                for doc_line in content.split("\n")[1:]:
                    if doc_line.strip().endswith(docstring_start):
                        lines.append(doc_line.strip()[:-3])
                        break
                    lines.append(doc_line)
                return " ".join(lines).strip()
            elif line.startswith("#"):
                return line[1:].strip()
        return ""
    except Exception:
        return ""


@router.get("/workflows", response_model=list[WorkflowInfo])
async def list_workflows():
    if not WORKFLOWS_DIR.exists():
        logger.info(f"Workflows directory not found: {WORKFLOWS_DIR}")
        return []

    workflows = []
    for file_path in WORKFLOWS_DIR.iterdir():
        if file_path.is_file() and file_path.suffix == ".py":
            description = _get_workflow_description(file_path)
            workflows.append(
                WorkflowInfo(
                    name=file_path.stem,
                    description=description,
                    path=str(file_path.absolute()),
                )
            )

    logger.info(f"Found {len(workflows)} workflows")
    return workflows
