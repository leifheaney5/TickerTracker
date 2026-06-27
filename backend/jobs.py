"""Cron entrypoint. Run on Railway via:  python backend/jobs.py check-alerts
                                          python backend/jobs.py weekly-digest"""
import sys
import logging
from services.alerts import check_alerts
from services.digest import send_weekly_digest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jobs")


def main(argv) -> int:
    if not argv:
        logger.error("usage: jobs.py <check-alerts|weekly-digest>")
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
    logger.error("unknown command: %s", cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
