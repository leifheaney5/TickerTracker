web: gunicorn --chdir backend app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 90
alerts: python backend/jobs.py check-alerts
digest: python backend/jobs.py weekly-digest
