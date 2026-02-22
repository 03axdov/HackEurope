import os
import sys
import threading
import time
from datetime import datetime, timedelta


_scheduler_started = False


def _seconds_until_next_hour(now: datetime) -> float:
    next_hour = (now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1))
    return max(0.0, (next_hour - now).total_seconds())


def _auto_detection_loop():
    while True:
        now = datetime.now().astimezone()
        sleep_seconds = _seconds_until_next_hour(now)
        time.sleep(sleep_seconds)

        try:
            from .views import run_detection_with_tracking

            print("[api.scheduler] Starting automatic detect_incidents run.")
            run_detection_with_tracking(run_type="automatic")
            print("[api.scheduler] Automatic detect_incidents run completed.")
        except Exception as exc:
            # Failure status/errorMessage is persisted by run_detection_with_tracking.
            print(f"[api.scheduler] Automatic detect_incidents run failed: {exc}")

        # Avoid rapid re-trigger if clock jitter wakes exactly on the boundary repeatedly.
        time.sleep(1)


def start_hourly_detection_scheduler():
    global _scheduler_started

    if _scheduler_started:
        return

    # Only start for the Django dev server command used in this project.
    if "runserver" not in sys.argv:
        return

    # Django runserver autoreload spawns a parent/child process. Start only in the child.
    if os.environ.get("RUN_MAIN") not in {"true", "1"}:
        return

    _scheduler_started = True
    thread = threading.Thread(
        target=_auto_detection_loop,
        name="hourly-detect-incidents",
        daemon=True,
    )
    thread.start()
    print("[api.scheduler] Hourly automatic detection scheduler started (runs at exact hour).")
