.PHONY: install dev docker test lint demo

# Makefile for DataForge Development Setup and Hackathon Demo

# Requires python & npm to be installed
install:
	@echo "Installing python dependencies..."
	pip install -r backend/requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Installing dataforge-cli in editable mode..."
	pip install -e cli/

dev:
	@echo "Starting development environment..."
	# Start frontend in background based on OS shell, but standard sh approach:
	cd frontend && npm run dev &
	uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

docker:
	@echo "Building and starting Docker environment..."
	docker-compose down
	docker-compose up --build -d
	@echo "DataForge is running on http://localhost:5173"

test:
	@echo "Running tests..."
	pytest tests/ --cov=backend

lint:
	@echo "Linting backend..."
	flake8 backend/ dataforge_analytics/ cli/
	@echo "Linting frontend..."
	cd frontend && npm run lint

demo:
	@echo "Generating sample dataset..."
	python sample_data/generate_demo.py
	@echo "Dataset generated. Starting dev stack..."
	make dev