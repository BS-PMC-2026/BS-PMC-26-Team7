"""
Backfill PAR values for all existing SensorReadings that have PAR IS NULL.

Run from the backend directory:
    python scripts/backfill_par.py

Requires the same DATABASE_URL environment variable (or .env file) used by the backend.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import SessionLocal
from models.sensor import SensorReading
from services.sensor_service import generate_par


def backfill():
    db = SessionLocal()
    try:
        readings = db.query(SensorReading).filter(SensorReading.PAR.is_(None)).all()
        total = len(readings)
        if total == 0:
            print("No readings need backfilling.")
            return

        print(f"Backfilling PAR for {total} readings…")
        batch_size = 500
        updated = 0

        for i, reading in enumerate(readings):
            reading.PAR = generate_par(
                sample_time=reading.SampleTimeUtc,
                temperature=reading.Temperature,
                humidity=reading.Humidity,
            )
            updated += 1

            if updated % batch_size == 0:
                db.commit()
                print(f"  Committed {updated}/{total}")

        db.commit()
        print(f"Done. Updated {updated} readings.")
    finally:
        db.close()


if __name__ == "__main__":
    backfill()
