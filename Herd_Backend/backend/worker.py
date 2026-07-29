"""
worker.py
Centralized Task Queue for background jobs (Email, Telegram).
Uses ThreadPoolExecutor to manage a fixed number of workers.
"""
from concurrent.futures import ThreadPoolExecutor
import logging

# Initialize a global executor with a fixed number of workers (e.g., 5)
# This prevents opening too many threads and hanging the system.
executor = ThreadPoolExecutor(max_workers=5)

def enqueue_task(fn, *args, **kwargs):
    """
    Submits a task to the background executor.
    Does not block the main execution.
    """
    try:
        executor.submit(fn, *args, **kwargs)
        logging.info(f"[WORKER] Task enqueued: {fn.__name__}")
    except Exception as e:
        logging.error(f"[WORKER ERROR] Failed to enqueue task {fn.__name__}: {e}")

def shutdown_worker():
    """Gracefully shutdown the executor"""
    executor.shutdown(wait=True)
