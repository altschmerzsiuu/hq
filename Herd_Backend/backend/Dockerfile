FROM python:3.11-slim

WORKDIR /app

# Install system deps (needed for some packages and Playwright)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser dependencies and chromium
RUN playwright install-deps chromium \
    && playwright install chromium

# Copy all backend source files
COPY app.py .
COPY auth_utils.py .
COPY auth_routes.py .
COPY profile_routes.py .
COPY chat_routes.py .
COPY report_routes.py .
COPY notifier.py .
COPY mailer.py .
COPY calendar_reminder.py .

# Copy directories
COPY ai/ ./ai/
COPY routers/ ./routers/

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]