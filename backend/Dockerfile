FROM python:3.11-slim

# Timezone Brasil
ENV TZ=America/Sao_Paulo
RUN apt-get update && apt-get install -y tzdata && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Scripts de sync
COPY backend/main.py .
COPY backend/sync_historico.py .
COPY backend/etl_historico.py .
COPY scripts/ ./scripts/

# Scheduler
COPY backend/scheduler.py .

CMD ["python", "-u", "scheduler.py"]
