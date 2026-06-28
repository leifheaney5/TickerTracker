"""Cron entrypoint. Run on Railway via:  python backend/jobs.py check-alerts
                                          python backend/jobs.py weekly-digest
                                          python backend/jobs.py snapshot-signals"""
import sys
import logging
from db import init_db
from services.alerts import check_alerts
from services.digest import send_weekly_digest
from services.signal_history import record_snapshots

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jobs")


def main(argv) -> int:
    # init_db() creates any MISSING tables so this separate cron process can
    # run standalone. NOTE: it does NOT run Alembic migrations and does NOT add
    # new columns to existing tables — the web-service deploy must have applied
    # migrations before the cron queries alert columns on an existing DB.
    init_db()
    if not argv:
        logger.error("usage: jobs.py <check-alerts|weekly-digest|snapshot-signals>")
        return 2
    cmd = argv[0]
    if cmd == "check-alerts":
        n = check_alerts()
        logger.info("alerts fired: %s", n)
        return 0
    if cmd == "weekly-digest":
        n = send_weekly_digest()
        logger.info("digests sent: %s", n)
        return 0
    if cmd == "snapshot-signals":
        n = record_snapshots()
        logger.info("signal snapshots written: %s", n)
        return 0
    logger.error("unknown command: %s", cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
