import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))


def generate_typescript(output_path: str = "../src/lib/api-types.ts"):
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    venv_path = Path(__file__).parent / ".venv" / "bin" / "pydantic2ts"
    pydantic2ts_cmd = str(venv_path) if venv_path.exists() else "pydantic2ts"

    try:
        result = subprocess.run(
            [
                pydantic2ts_cmd,
                "--module",
                "schemas",
                "--output",
                str(output_file.absolute()),
            ],
            capture_output=True,
            text=True,
            check=True,
            cwd=Path(__file__).parent,
            env={
                **dict(os.environ),
                "PATH": f"{Path(__file__).parent.parent / 'node_modules' / '.bin'}:{os.environ.get('PATH', '')}",
            },
        )
        print(f"TypeScript types generated at {output_file}")
        if result.stdout:
            print(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"Error generating TypeScript types: {e.stderr}")
        raise
    except FileNotFoundError:
        print(
            "pydantic2ts not found. Install with: pip install pydantic-to-typescript>=2"
        )
        raise


def generate_via_json_schema(output_path: str = "../src/lib/api-types.ts"):
    from schemas import (
        DefaultResponse,
        ChatCompletionRequest,
        ChatMessageBase,
        HealthResponse,
        WorkflowInfo,
        EmbeddingProgress,
        TextHighlight,
        Artifact,
        KnowledgeGraphOrStorage,
        MessageRole,
    )

    models = [
        DefaultResponse,
        ChatCompletionRequest,
        ChatMessageBase,
        HealthResponse,
        WorkflowInfo,
        EmbeddingProgress,
        TextHighlight,
        Artifact,
        KnowledgeGraphOrStorage,
    ]

    schemas = {"$schema": "http://json-schema.org/draft-07/schema#", "definitions": {}}

    for model in models:
        schema = model.model_json_schema(
            mode="serialization", ref_template="#/definitions/{model}"
        )
        if "$defs" in schema:
            for def_name, def_schema in schema.pop("$defs").items():
                schemas["definitions"][def_name] = def_schema
        schemas["definitions"][model.__name__] = schema

    json_path = Path("/tmp/api-schemas.json")
    json_path.write_text(json.dumps(schemas, indent=2))

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    try:
        result = subprocess.run(
            [
                "bunx",
                "json2ts",
                "-i",
                str(json_path),
                "-o",
                str(output_file.absolute()),
                "--unreachableDefinitions",
            ],
            capture_output=True,
            text=True,
            check=True,
            cwd=Path(__file__).parent.parent,
        )
        print(f"TypeScript types generated at {output_file}")
    except subprocess.CalledProcessError as e:
        print(f"Error with json-schema-to-typescript: {e.stderr}")
        raise
    except FileNotFoundError:
        print("npx not found. Ensure Node.js is installed.")
        raise


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Generate TypeScript types from Pydantic schemas"
    )
    parser.add_argument(
        "--output", "-o", default="../src/lib/api-types.ts", help="Output file path"
    )
    parser.add_argument(
        "--method",
        "-m",
        choices=["pydantic2ts", "jsonschema"],
        default="jsonschema",
        help="Generation method (jsonschema recommended - uses local node_modules)",
    )
    args = parser.parse_args()

    if args.method == "pydantic2ts":
        generate_typescript(args.output)
    else:
        generate_via_json_schema(args.output)
