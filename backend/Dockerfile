FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install only necessary system libs for psycopg2 and healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev curl build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# No CMD here; we define the commands in docker-compose