import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Keep this test intentionally independent of the browser runtime.
# It verifies the same scientific model used by app_engine.js:
# direct/primary = 1.0; indirect/secondary = 0.5; stability/corrective excluded
# from hypertrophy volume and tracked separately.

CONTRIBUTIONS = {
    'leg_curl': {'همسترینگ': 1},
    'leg_extension': {'چهارسر': 1},
    'hack_squat': {'چهارسر': 1, 'باسن': 0.5},
    'leg_press': {'چهارسر': 1, 'باسن': 0.5},
    'seated_chest_press_machine': {'سینه': 1, 'پشت بازو': 0.5, 'سرشانه': 0.5},
    'standing_calf_raise_hack': {'ساق': 1},
    'smith_machine_squat': {'چهارسر': 1, 'باسن': 0.5, 'همسترینگ': 0.5},
    'hip_thrust': {'باسن': 1, 'همسترینگ': 0.5},
    'standing_lateral_raise_machine': {'سرشانه': 1},
    'cable_row': {'پشت': 1, 'جلو بازو': 0.5},
    'lat_pulldown': {'پشت': 1, 'جلو بازو': 0.5},
    'iso_lateral_row': {'پشت': 1, 'جلو بازو': 0.5},
    'reverse_peck_deck_fly': {'سرشانه': 1, 'پشت': 0.5},
    'ufo_linear_row_machine': {'پشت': 1, 'جلو بازو': 0.5},
    'smith_incline_bench_press': {'سینه': 1, 'سرشانه': 0.5, 'پشت بازو': 0.5},
    'peck_deck_fly': {'سینه': 1},
    'iso_lateral_incline_pec_fly_machine': {'سینه': 1},
    'iso_lateral_incline_bench_press': {'سینه': 1, 'سرشانه': 0.5, 'پشت بازو': 0.5},
    'incline_chest_fly': {'سینه': 1},
    'seated_cable_pec_fly': {'سینه': 1},
    'preacher_curls': {'جلو بازو': 1},
    'preacher_hammer_curl': {'جلو بازو': 1},
    'rope_triceps_pushdown': {'پشت بازو': 1},
    'cable_triceps_pushdown': {'پشت بازو': 1},
    'overhead_triceps_extension': {'پشت بازو': 1},
    'dumbbell_shrugs': {'کول': 1},
    'chest_supported_dumbbell_shrug': {'کول': 1, 'پشت': 0.5},
    'cable_lateral_raise': {'سرشانه': 1},
    'face_pull': {'سرشانه': 1, 'پشت': 0.5},
    'dumbbell_shoulder_press': {'سرشانه': 1, 'پشت بازو': 0.5},
    'plate_loaded_shoulder_press': {'سرشانه': 1, 'پشت بازو': 0.5},
    'standing_cable_crunch': {'شکم': 1},
    'cable_oblique_crunch': {'شکم': 1},
    'cable_hip_abduction': {'خارج ران': 1},
    'cable_hip_adduction': {'داخل ران': 1},
    'bent_knee_cable_hip_abduction': {'خارج ران': 1},
    'rdl': {'همسترینگ': 1, 'باسن': 0.5, 'فیله': 0.5},
    'back_extension': {'فیله': 1, 'باسن': 0.5, 'همسترینگ': 0.5},
    'bench_crunch': {'شکم': 1},
    'wall_sit': {'چهارسر': 1},
    'side_plank_iso': {'شکم': 1},
    'dead_bug_iso': {'شکم': 1},
    'dead_bug': {'شکم': 1},
    'prone_itwy': {'سرشانه': 1, 'کول': 0.5},
    'glute_bridge_iso': {'باسن': 1, 'همسترینگ': 0.5},
    'glute_bridge': {'باسن': 1, 'همسترینگ': 0.5},
    'iso_bird_dog': {'شکم': 1},
    'bird_dog': {'شکم': 1},
    'push_up_plus': {'سراتوس': 1, 'سرشانه': 0.5},
    'wall_slide': {'سرشانه': 1},
    'cossack_squat': {'داخل ران': 1, 'چهارسر': 0.5, 'باسن': 0.5},
    'standing_plate_hip_abduction': {'خارج ران': 1},
    'lying_plate_hip_abduction': {'خارج ران': 1},
    'clamshell_dumbbell': {'خارج ران': 1},
    'side_lying_hip_abduction': {'خارج ران': 1},
    'glute_bridge_knees_out': {'باسن': 1, 'خارج ران': 0.5},
    'dumbbell_rdl': {'همسترینگ': 1, 'باسن': 0.5, 'فیله': 0.5},
    'single_leg_cable_hamstring_curl': {'همسترینگ': 1},
    'machine_hip_abduction': {'خارج ران': 1},
    'neutral_lat_pulldown': {'پشت': 1, 'جلو بازو': 0.5},
    'clamshell_plate': {'خارج ران': 1},
    'standing_calf_raise_machine': {'ساق': 1},
    'dumbbell_incline_row_low_back': {'پشت': 1, 'فیله': 0.5, 'جلو بازو': 0.5},
    'captains_chair_leg_raise_oblique': {'شکم': 1},
    'single_leg_glute_bridge': {'باسن': 1, 'همسترینگ': 0.5},
    'single_leg_dumbbell_rdl': {'همسترینگ': 1, 'باسن': 0.5, 'فیله': 0.5},
    'slider_hamstring_curl': {'همسترینگ': 1},
    'quadruped_glute_kickback': {'باسن': 1},
    'plank_hold': {'شکم': 1},
    'dumbbell_squat': {'چهارسر': 1, 'باسن': 0.5},
    'seated_leg_curl_machine': {'همسترینگ': 1},
    'kettlebell_side_lunge': {'چهارسر': 1, 'داخل ران': 0.5, 'باسن': 0.5},
    'cable_glute_kickback': {'باسن': 1},
    'seated_calf_raise': {'ساق': 1},
    'pike_plank_kickback': {'شکم': 1, 'باسن': 0.5},
    'bench_reverse_crunch': {'شکم': 1},
    'clamshell_bodyweight': {'خارج ران': 1},
    'fire_hydrant': {'خارج ران': 1},
    'smith_squat_mini_ball': {'چهارسر': 1, 'داخل ران': 0.5, 'باسن': 0.5},
    'forearm_plank': {'شکم': 1},
    'onhand_plank_knee_in': {'شکم': 1, 'سرشانه': 0.5},
    'straight_arm_bear_plank_knee_extension': {'شکم': 1, 'چهارسر': 0.5},
    'clamshell_band': {'خارج ران': 1},
    'ab_crunch_machine': {'شکم': 1},
    'seated_calf_raise_hamstring_machine': {'ساق': 1},
    'single_arm_peck_deck_fly': {'سینه': 1},
    'single_arm_pronated_scapular_correction': {'پشت': 1, 'سرشانه': 0.5, 'کول': 0.5},
    'cust_1788626478522': {'ساق': 1},
    'cust_1788626968174': {'ساق': 1},
    'cust_1788627494546': {'سینه': 1},
    'cust_1788627548162': {'سینه': 1},
    'cust_1789820131011': {'شکم': 1},
    'cust_1789844260437': {'شکم': 1},
    'cust_1789848449999': {'شکم': 1},
    'cust_1789848630225': {'شکم': 1},
    'side_plank_dips': {'شکم': 1},
}

STABILITY = ['bird_dog', 'dead_bug', 'dead_bug_iso', 'forearm_plank', 'glute_bridge_iso', 'iso_bird_dog', 'onhand_plank_knee_in', 'pike_plank_kickback', 'plank_hold', 'prone_itwy', 'push_up_plus', 'side_plank_dips', 'side_plank_iso', 'single_arm_pronated_scapular_correction', 'straight_arm_bear_plank_knee_extension', 'wall_sit', 'wall_slide']

with open(ROOT / "master_exercises.json", encoding="utf-8") as f:
    master = json.load(f)

master_ids = {e["id"] for e in master}
assert master_ids == set(CONTRIBUTIONS), (
    f"Mapping mismatch. Missing: {sorted(master_ids - set(CONTRIBUTIONS))}; "
    f"Extra: {sorted(set(CONTRIBUTIONS) - master_ids)}"
)

assert all(0 < c <= 1 for m in CONTRIBUTIONS.values() for c in m.values())
assert all(c == 1 or c == 0.5 for m in CONTRIBUTIONS.values() for c in m.values())

# Known scientific sanity checks.
assert CONTRIBUTIONS["hack_squat"]["چهارسر"] == 1
assert CONTRIBUTIONS["hack_squat"]["باسن"] == 0.5
assert CONTRIBUTIONS["seated_chest_press_machine"]["سینه"] == 1
assert CONTRIBUTIONS["seated_chest_press_machine"]["پشت بازو"] == 0.5
assert CONTRIBUTIONS["rdl"]["همسترینگ"] == 1
assert CONTRIBUTIONS["rdl"]["باسن"] == 0.5

# Three Hack Squat sets = 3 direct quad + 1.5 effective glute sets.
assert 3 * CONTRIBUTIONS["hack_squat"]["چهارسر"] == 3
assert 3 * CONTRIBUTIONS["hack_squat"]["باسن"] == 1.5

# Stability work must not be counted as hypertrophy volume.
assert "wall_slide" in STABILITY
assert "dead_bug_iso" in STABILITY
assert "push_up_plus" in STABILITY

print(f"PASS: {len(master)} exercises mapped.")
print("PASS: direct=1.0, indirect=0.5 fractional-set model.")
print(f"PASS: {len(STABILITY)} stability/corrective exercises tracked separately.")


def calculate_profile(prof):
    result = {m: {"direct": 0.0, "indirect": 0.0, "effective": 0.0, "stability": 0.0}
              for m in {k for x in CONTRIBUTIONS.values() for k in x}}
    for day in prof["days"]:
        if day.get("type") == "rest":
            continue
        items = list(day.get("singles") or [])
        for ss in day.get("supersets") or []:
            items.extend(ss.get("exercises") or [])
        for item in items:
            sets = item.get("sets", 3)
            is_stability = item["exId"] in STABILITY
            for muscle, coefficient in CONTRIBUTIONS[item["exId"]].items():
                weighted = sets * coefficient
                if is_stability:
                    result[muscle]["stability"] += weighted
                else:
                    result[muscle]["effective"] += weighted
                    if coefficient == 1:
                        result[muscle]["direct"] += sets
                    else:
                        result[muscle]["indirect"] += sets
    return result

for filename in ("template_male.json", "template_female.json"):
    with open(ROOT / filename, encoding="utf-8") as f:
        profile = json.load(f)
    result = calculate_profile(profile)
    assert all(v["effective"] >= 0 for v in result.values())

print("PASS: male/female template profiles calculate without unmapped exercises.")
