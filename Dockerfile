# ── Stage 1: build the React frontend ────────────────────────────────────────
FROM node:22-slim AS frontend
WORKDIR /app/frontend

# Install deps. The npm optional-dependencies bug (npm/cli#4828) skips Vite 8 /
# rolldown's native linux binary when a lockfile from another platform/npm
# version is present, so we install without the lockfile in this isolated layer
# to force correct platform resolution. The committed lockfile remains the
# source of truth in git; only this ephemeral build container ignores it.
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY frontend/ ./
RUN npm run build
# → produces /app/frontend/dist

# ── Stage 2: Python backend that serves the build + API ──────────────────────
FROM python:3.11-slim AS app
WORKDIR /app

# Copy requirements + backend first: the root requirements.txt references
# backend/requirements.txt via `-r`, so that file must exist before pip runs.
COPY requirements.txt ./
COPY backend/ ./backend/
RUN pip install --no-cache-dir -r requirements.txt

# The built frontend from stage 1.
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Railway provides $PORT at runtime. TickerTracker is a low-concurrency service;
# keep one Gunicorn process and use threads for request concurrency so pandas,
# yfinance, SQLAlchemy, and auth dependencies are not duplicated in memory.
# Native numerical libraries can otherwise size thread pools from the Railway
# host CPU count, so cap those pools as well.
ENV PYTHONUNBUFFERED=1 \
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1 \
    MALLOC_ARENA_MAX=2
CMD ["sh", "-c", "gunicorn --chdir backend app:app --bind 0.0.0.0:${PORT:-5000} --workers 1 --threads 4 --timeout 90"]
