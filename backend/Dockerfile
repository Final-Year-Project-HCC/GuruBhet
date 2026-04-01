FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies and Poetry with retry logic
RUN for i in 1 2 3; do \
    apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev curl build-essential \
    && break || sleep 5; \
    done \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir poetry

# Copy poetry files
COPY pyproject.toml poetry.lock .

# Install dependencies using Poetry
RUN poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi

COPY . .

# No CMD here; we define the commands in docker-compose