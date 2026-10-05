"""Regression tests for Chieftain's scientific weekly-volume model.

Model used by app_engine.js:
  direct contribution   = 1.0
  meaningful indirect  = 0.5
  stability/corrective  = tracked separately, not added to hypertrophy volume
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JS = (ROOT / "app_engine.js").read_text(encoding="utf-8")
MASTER = json.loads((ROOT / "master_exercises.json").read_text(encoding="utf-8"))

start = JS.index("const EXERCISE_MUSCLE_MAPPING = {")
end = JS.index("};\n\n// Exercises whose primary purpose", start) + 2
mapping_block = JS[start:end]

# Every exercise key in the production mapping has an object value.
MAPPED_IDS = set(re.findall(r"^\s*'([^']+)'\s*:\s*\{", mapping_block, re.M))
MASTER_IDS = {e["id"] for e in MASTER}

# Extract every numeric coefficient used by the mapping.
WEIGHTS = [float(x) for x in re.findall(r":\s*([01](?:\.\d+)?)\s*[,}]", mapping_block)]

assert MASTER_IDS <= MAPPED_IDS, f"Unmapped master exercises: {sorted(MASTER_IDS - MAPPED_IDS)}"
assert WEIGHTS, "No muscle contribution weights found."
assert all(w in (0.5, 1.0) for w in WEIGHTS), f"Unexpected contribution weights: {sorted(set(WEIGHTS))}"
assert "DIRECT_SET_WEIGHT = 1.0" in JS
assert "INDIRECT_SET_WEIGHT = 0.5" in JS
assert "STABILITY_EXERCISES = new Set" in JS
assert "effectiveSets" in JS
assert "directSets" in JS
assert "indirectSets" in JS
assert "stabilitySets" in JS
assert "Scientific Weekly Muscle Volume" in JS

print(f"PASS: {len(MASTER_IDS)} master exercises are mapped.")
print("PASS: contribution weights are limited to direct=1.0 and indirect=0.5.")
print("PASS: stability/corrective work is tracked separately.")
print("PASS: effective/direct/indirect/stability fields and scientific Summary UI are present.")
