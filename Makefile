types:
	cd ./src-python && .venv/bin/python generate_types.py
	bun run db:generate

dev-python:
	cd ./src-python && .venv/bin/python main.py