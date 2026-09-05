import json, sys
sys.stdout.reconfigure(encoding='utf-8')

# Definitive Exercise to Target Muscle Groups Mapping
EXERCISE_MUSCLE_MAPPING = {
    # Chest (سینه)
    'chest_press_machine': ['سینه'],
    'seated_chest_press_machine': ['سینه'],
    'incline_smith_press': ['سینه'],
    'smith_incline_bench_press': ['سینه'],
    'iso_lateral_incline_bench_press': ['سینه'],
    'peck_deck_fly': ['سینه'],
    'incline_fly_machine': ['سینه'],
    'iso_lateral_incline_pec_fly_machine': ['سینه'],
    'incline_chest_fly': ['سینه'],
    'seated_cable_pec_fly': ['سینه'],
    'cable_fly': ['سینه'],
    'single_arm_peck_deck_fly': ['سینه'],

    # Lats & Back (زیر بغل و پشت)
    'lat_pulldown': ['پشت'],
    'neutral_lat_pulldown': ['پشت'],
    'cable_seated_row': ['پشت'],
    'cable_row': ['پشت'],
    'iso_lateral_row': ['پشت'],
    'ufo_lat_pulldown': ['پشت'],
    'ufo_linear_row_machine': ['پشت'],
    'dumbbell_row': ['پشت'],
    'lat_pulldown_underhand': ['پشت'],
    'single_arm_pronated_scapular_correction': ['پشت', 'سرشانه'],

    # Shoulders (سرشانه و دلتوئید)
    'machine_lateral_raise': ['سرشانه'],
    'standing_lateral_raise_machine': ['سرشانه'],
    'dumbbell_lateral_raise': ['سرشانه'],
    'plate_loaded_shoulder_press': ['سرشانه'],
    'dumbbell_shoulder_press': ['سرشانه'],
    'cable_lateral_raise': ['سرشانه'],
    'reverse_peck_deck': ['سرشانه'],
    'reverse_peck_deck_fly': ['سرشانه'],
    'cable_face_pull': ['سرشانه'],
    'face_pull': ['سرشانه'],
    'prone_itwy': ['سرشانه'],
    'wall_slide': ['سرشانه'],
    'dumbbell_shrugs': ['سرشانه'],
    'chest_supported_dumbbell_shrug': ['سرشانه', 'پشت'],

    # Biceps (جلو بازو)
    'ez_bar_preacher_curl': ['جلو بازو'],
    'preacher_curls': ['جلو بازو'],
    'hammer_preacher_curl': ['جلو بازو'],
    'preacher_hammer_curl': ['جلو بازو'],
    'cable_bicep_curl': ['جلو بازو'],
    'dumbbell_bicep_curl': ['جلو بازو'],
    'incline_dumbbell_curl': ['جلو بازو'],

    # Triceps (پشت بازو)
    'rope_tricep_pushdown': ['پشت بازو'],
    'rope_triceps_pushdown': ['پشت بازو'],
    'overhead_rope_tricep_extension': ['پشت بازو'],
    'overhead_triceps_extension': ['پشت بازو'],
    'cable_tricep_pushdown': ['پشت بازو'],
    'cable_triceps_pushdown': ['پشت بازو'],
    'skull_crusher': ['پشت بازو'],

    # Quads (چهارسر ران)
    'leg_extension': ['چهارسر'],
    'hack_squat': ['چهارسر', 'باسن'],
    'leg_press': ['چهارسر', 'باسن'],
    'smith_squat_mini_ball': ['چهارسر', 'داخل ران', 'باسن'],
    'smith_machine_squat': ['چهارسر', 'باسن'],
    'dumbbell_squat': ['چهارسر', 'باسن'],
    'wall_sit': ['چهارسر'],
    'cossack_squat': ['چهارسر', 'داخل ران', 'باسن'],
    'kettlebell_side_lunge': ['چهارسر', 'داخل ران', 'باسن'],

    # Hamstrings (همسترینگ)
    'leg_curl': ['همسترینگ'],
    'seated_leg_curl_machine': ['همسترینگ'],
    'single_leg_cable_hamstring_curl': ['همسترینگ'],
    'slider_hamstring_curl': ['همسترینگ'],
    'rdl': ['همسترینگ', 'باسن', 'فیله'],
    'dumbbell_rdl': ['همسترینگ', 'باسن', 'فیله'],
    'single_leg_dumbbell_rdl': ['همسترینگ', 'باسن', 'فیله'],

    # Glutes (سرینی و باسن)
    'hip_thrust': ['باسن'],
    'glute_bridge': ['باسن'],
    'glute_bridge_iso': ['باسن'],
    'glute_bridge_knees_out': ['باسن'],
    'single_leg_glute_bridge': ['باسن', 'همسترینگ'],
    'cable_glute_kickback': ['باسن'],
    'quadruped_glute_kickback': ['باسن'],

    # Abductors / Glute Medius (خارج ران و سرینی میانی)
    'machine_hip_abduction': ['خارج ران'],
    'cable_hip_abduction': ['خارج ران'],
    'bent_knee_cable_hip_abduction': ['خارج ران'],
    'standing_plate_hip_abduction': ['خارج ران'],
    'lying_plate_hip_abduction': ['خارج ران'],
    'side_lying_hip_abduction': ['خارج ران'],
    'clamshell_plate': ['خارج ران'],
    'clamshell_band': ['خارج ران'],
    'clamshell_dumbbell': ['خارج ران'],
    'clamshell_bodyweight': ['خارج ران'],
    'fire_hydrant': ['خارج ران'],

    # Adductors (داخل ران)
    'cable_hip_adduction': ['داخل ران'],

    # Calves (ساق پا)
    'standing_calf_raise_hack': ['ساق'],
    'standing_calf_raise_machine': ['ساق'],
    'seated_calf_raise': ['ساق'],
    'seated_calf_raise_hamstring_machine': ['ساق'],

    # Lower Back (فیله و پایین کمر)
    'back_extension': ['فیله', 'باسن'],
    'dumbbell_incline_row_low_back': ['فیله', 'پشت'],

    # Core & Abs (شکم و عضلات مرکزی)
    'ab_crunch_machine': ['شکم'],
    'standing_cable_crunch': ['شکم'],
    'cable_oblique_crunch': ['شکم'],
    'bench_crunch': ['شکم'],
    'bench_reverse_crunch': ['شکم'],
    'captains_chair_leg_raise_oblique': ['شکم'],
    'dead_bug': ['شکم'],
    'dead_bug_iso': ['شکم'],
    'bird_dog': ['شکم'],
    'iso_bird_dog': ['شکم'],
    'side_plank_iso': ['شکم'],
    'side_plank_dips': ['شکم'],
    'plank_hold': ['شکم'],
    'forearm_plank': ['شکم'],
    'onhand_plank_knee_in': ['شکم'],
    'straight_arm_bear_plank_knee_extension': ['شکم'],
    'pike_plank_kickback': ['شکم'],
    'push_up_plus': ['شکم']
}

with open('master_exercises.json', 'r', encoding='utf-8') as f:
    master_ex = json.load(f)

with open('hossein_profile.json', 'r', encoding='utf-8') as f:
    h_prof = json.load(f)

with open('morvarid_profile.json', 'r', encoding='utf-8') as f:
    m_prof = json.load(f)

ex_map = {e['id']: e for e in master_ex}

# Verify unmapped
unmapped = [e['id'] for e in master_ex if e['id'] not in EXERCISE_MUSCLE_MAPPING]
print(f"Total exercises in library: {len(master_ex)}")
print(f"Unmapped count: {len(unmapped)}")
assert len(unmapped) == 0, f"Unmapped exercises exist: {unmapped}"

muscleGroups = [
    ('سینه', 'سینه (Chest)'),
    ('پشت', 'زیر بغل و پشت (Lats & Back)'),
    ('سرشانه', 'سرشانه و دلتوئید (Shoulders)'),
    ('جلو بازو', 'جلو بازو (Biceps)'),
    ('پشت بازو', 'پشت بازو (Triceps)'),
    ('چهارسر', 'چهارسر ران (Quads)'),
    ('همسترینگ', 'همسترینگ (Hamstrings)'),
    ('باسن', 'سرینی و باسن (Glutes)'),
    ('خارج ران', 'خارج ران و سرینی میانی (Abductors)'),
    ('داخل ران', 'داخل ران (Adductors)'),
    ('ساق', 'ساق پا (Calves)'),
    ('فیله', 'فیله و پایین کمر (Lower Back)'),
    ('شکم', 'عضلات مرکزی و شکم (Core & Abs)')
]

def analyze_profile(prof):
    print(f"\n==========================================")
    print(f"  ANATOMICAL VOLUME SUMMARY: {prof['name']}")
    print(f"==========================================")
    stats = {k: {'label': label, 'sets': 0, 'days': set(), 'exercises': set()} for k, label in muscleGroups}
    for day in prof['days']:
        if day.get('type') == 'rest': continue
        items = []
        if day.get('singles'): items.extend(day['singles'])
        if day.get('supersets'):
            for ss in day['supersets']: items.extend(ss['exercises'])
        for item in items:
            ex_id = item['exId']
            ex = ex_map.get(ex_id, {'fa': ex_id})
            sets = item.get('sets', 3)
            assigned_muscles = EXERCISE_MUSCLE_MAPPING.get(ex_id, [])
            for m_key in assigned_muscles:
                if m_key in stats:
                    stats[m_key]['sets'] += sets
                    stats[m_key]['days'].add(day['title'])
                    stats[m_key]['exercises'].add(ex['fa'])

    for k, label in muscleGroups:
        s = stats[k]
        if s['sets'] > 0:
            print(f"{s['label']:<38} | {s['sets']:2d} ست | {len(s['days'])} جلسه ({', '.join(s['days'])})")
            print(f"   -> حرکات: {', '.join(s['exercises'])}")

analyze_profile(h_prof)
analyze_profile(m_prof)
