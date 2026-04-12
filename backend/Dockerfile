FROM python:3.12-slim

# Standard Python environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_ROOT_USER_ACTION=ignore

WORKDIR /app

# Step 1: Install system dependencies & Poetry
# We use your original logic here as it was confirmed working
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev curl build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir poetry

# Step 2: Copy ONLY dependency files
# This ensures that if you only change code, Docker skips the install step
COPY pyproject.toml poetry.lock* ./

# Step 3: Install dependencies
# We use your original flags here to ensure compatibility
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --no-root

# Step 4: Copy the rest of the application code
# This is placed AFTER the install so it doesn't bust the cache
COPY . .