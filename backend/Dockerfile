# Use a specific slim image for a smaller footprint
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POETRY_VERSION=1.8.2 \
    POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1

WORKDIR /app

# Step 1: Install system dependencies
# These change the least often, so they stay at the top.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Step 2: Install Poetry
# We do this separately so it's cached independently of your app dependencies.
RUN pip install --no-cache-dir "poetry==$POETRY_VERSION"

# Step 3: Copy only the dependency files
# This is the "Secret Sauce" for speed.
COPY pyproject.toml poetry.lock ./

# Step 4: Install Python dependencies
# Docker will cache this layer. It only re-runs if pyproject.toml or poetry.lock changes.
# We use --no-root because we haven't copied the actual app code yet.
RUN poetry install --no-root --without dev

# Step 5: Copy the rest of the application code
# This layer will change frequently. By putting it last, we don't break the cache above.
COPY . .

# Reminder: Commands like 'python manage.py runserver' are handled in your docker-compose.yml