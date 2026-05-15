types:
	uv run --python ./src-python/.venv/bin/python python ./src-python/generate_types.py
	bun run db:generate

dev-python:
	cd ./src-python && .venv/bin/python main.py

serena:
	uvx --from git+https://github.com/oraios/serena serena start-mcp-server --transport streamable-http --port 9121 --project-from-cwd --context codex
