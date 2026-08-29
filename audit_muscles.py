import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('master_exercises.json', 'r', encoding='utf-8') as f:
    exercises = json.load(f)

print(f"Total exercises: {len(exercises)}")
for i, ex in enumerate(exercises):
    print(f"{i+1:2d}. {ex['id']:<40} | FA: {ex['fa']:<35} | MUSCLES: {ex.get('muscles','')}")
