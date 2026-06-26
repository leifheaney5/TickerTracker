# ── Stage 1: build the React frontend ────────────────────────────────────────
FROM node:22-slim AS frontend
WORKDIR /app/frontend

# Install deps. The npm optional-dependencies bug (npm/cli#4828) skips Vite 8 /
# rolldown's native linux binary when a lockfile from another platform/npm
# version is present, so we install without the lockfile in this isolated layer
# to force correct platform resolution. The committed lockfile remains the
# source of truth in git; only this ephemeral build container ignores it.
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund

COPY frontend/ ./
RUN npm run build
# → produces /app/frontend/dist

# ── Stage 2: Python backend that serves the build + API ──────────────────────
FROM python:3.11-slim AS app
WORKDIR /app

# System deps kept minimal; gunicorn serves the Flask app.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Backend code + the built frontend from stage 1.
COPY backend/ ./backend/
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Railway provides $PORT at runtime.
ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "gunicorn --chdir backend app:app --bind 0.0.0.0:${PORT:-5000} --workers 2 --threads 4 --timeout 90"]
