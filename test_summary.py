import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
with open(ROOT / "master_exercises.json", encoding="utf-8") as f:
    exercises = json.load(f)

assert len(exercises) == 96
assert all(e.get("id") and e.get("fa") for e in exercises)

print("PASS: exercise library is readable and contains", len(exercises), "exercises.")
print("For muscle-volume correctness run: python test_scientific_summary.py")
