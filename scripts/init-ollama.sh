#!/bin/sh
set -e

echo "Pulling Ollama model: ${OLLAMA_EMAIL_MODEL:-llama3.2:3b}"

# Wait for Ollama to be ready
until ollama list > /dev/null 2>&1; do
  echo "Waiting for Ollama service..."
  sleep 2
done

# Pull the model if not already present
MODEL="${OLLAMA_EMAIL_MODEL:-llama3.2:3b}"
if ! ollama list | grep -q "$MODEL"; then
  echo "Downloading model $MODEL (this may take several minutes)..."
  ollama pull "$MODEL"
  echo "Model $MODEL downloaded successfully"
else
  echo "Model $MODEL already exists"
fi

echo "Ollama initialization complete"
