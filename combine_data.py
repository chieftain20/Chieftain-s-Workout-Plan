import json

with open('part1.json', 'r', encoding='utf-8') as f:
    p1 = json.load(f)
with open('part2.json', 'r', encoding='utf-8') as f:
    p2 = json.load(f)
with open('part3.json', 'r', encoding='utf-8') as f:
    p3 = json.load(f)

master_exercises = p1 + p2 + p3
with open('master_exercises.json', 'w', encoding='utf-8') as f:
    json.dump(master_exercises, f, ensure_ascii=False, indent=2)

template_male_profile = {
    "id": "template_male",
    "name": "برنامه نمونه آقایان (هایپرتروفی ۵ روزه)",
    "isDefault": True,
    "days": [
        {
            "id": "d1", "title": "شنبه", "type": "gym", "badge": "🏋️ باشگاه",
            "note": "۷۵ دقیقه تمرین با وزنه + ۱۵ دقیقه تردمیل در انتهای جلسه · حرکات اصلی حدود 2 RIR",
            "treadmill": True,
            "supersets": [
                {
                    "title": "A1 + A2 · هک اسکوات + نشر جانب دستگاه",
                    "exercises": [
                        {"exId": "hack_squat", "reps": "3 × 8–12", "sets": 3},
                        {"exId": "standing_lateral_raise_machine", "reps": "3 × 12–20", "sets": 3}
                    ]
                },
                {
                    "title": "B1 + B2 · پرس بالا سینه اسمیت + پشت پا دستگاه",
                    "exercises": [
                        {"exId": "smith_incline_bench_press", "reps": "3 × 6–10", "sets": 3},
                        {"exId": "leg_curl", "reps": "3 × 10–15", "sets": 3}
                    ]
                },
                {
                    "title": "C1 + C2 · یوفو زیر بغل + پشت بازو طناب",
                    "exercises": [
                        {"exId": "ufo_linear_row_machine", "reps": "3 × 8–12", "sets": 3},
                        {"exId": "rope_triceps_pushdown", "reps": "3 × 10–15", "sets": 3}
                    ]
                },
                {
                    "title": "D1 + D2 · ساق با هک اسکوات + کرانچ ایستاده کابل",
                    "exercises": [
                        {"exId": "standing_calf_raise_hack", "reps": "3 × 10–15", "sets": 3},
                        {"exId": "standing_cable_crunch", "reps": "3 × 10–15", "sets": 3}
                    ]
                },
                {
                    "title": "E1 + E2 · ابداکشن کابل + اداکشن کابل",
                    "exercises": [
                        {"exId": "cable_hip_abduction", "reps": "3 × 12–20", "sets": 3},
                        {"exId": "cable_hip_adduction", "reps": "3 × 12–20", "sets": 3}
                    ]
                }
            ],
            "singles": [
                {"exId": "back_extension", "reps": "3 × 10–15", "sets": 3}
            ]
        },
        {
            "id": "d2", "title": "یکشنبه", "type": "home", "badge": "🏠 خانه",
            "note": "تمرکز بر پایداری ستون فقرات، تقویت عضلات Core و کنترل ایزومتریک در خانه",
            "treadmill": False,
            "supersets": [],
            "singles": [
                {"exId": "dead_bug_iso", "reps": "3 × 20–30 ثانیه", "sets": 3},
                {"exId": "side_plank_iso", "reps": "3 × 20–40 ثانیه هر طرف", "sets": 3},
                {"exId": "wall_sit", "reps": "3 × 30–60 ثانیه", "sets": 3},
                {"exId": "iso_bird_dog", "reps": "3 × 20–30 ثانیه هر طرف", "sets": 3},
                {"exId": "push_up_plus", "reps": "3 × 8–15", "sets": 3}
            ]
        },
        {
            "id": "d3", "title": "دوشنبه", "type": "gym", "badge": "🏋️ باشگاه",
            "note": "۷۵ دقیقه تمرین با وزنه + ۱۵ دقیقه تردمیل در انتهای جلسه · حرکات اصلی حدود 2 RIR",
            "treadmill": True,
            "supersets": [
                {
                    "title": "A1 + A2 · پرس پا + ریورس پک‌دک",
                    "exercises": [
                        {"exId": "leg_press", "reps": "3 × 8–12", "sets": 3},
                        {"exId": "reverse_peck_deck_fly", "reps": "3 × 12–20", "sets": 3}
                    ]
                },
                {
                    "title": "B1 + B2 · پرس بالا سینه اسمیت + جلو پا دستگاه",
                    "exercises": [
                        {"exId": "smith_incline_bench_press", "reps": "3 × 6–10", "sets": 3},
                        {"exId": "leg_extension", "reps": "3 × 10–15", "sets": 3}
                    ]
                },
                {
                    "title": "C1 + C2 · لت سیم‌کش + جلو بازو لاری",
                    "exercises": [
                        {"exId": "lat_pulldown", "reps": "3 × 8–12", "sets": 3},
                        {"exId": "preacher_curls", "reps": "3 × 8–12", "sets": 3}
                    ]
                },
                {
                    "title": "D1 + D2 · پرس سرشانه دستگاه + پشت پا دستگاه",
                    "exercises": [
                        {"exId": "plate_loaded_shoulder_press", "reps": "3 × 8–12", "sets": 3},
                        {"exId": "leg_curl", "reps": "3 × 10–15", "sets": 3}
                    ]
                },
                {
                    "title": "E1 + E2 · پک‌دک فلای + ساق با هک اسکوات",
                    "exercises": [
                        {"exId": "peck_deck_fly", "reps": "3 × 10–15", "sets": 3},
                        {"exId": "standing_calf_raise_hack", "reps": "3 × 10–15", "sets": 3}
                    ]
                },
                {
                    "title": "F1 + F2 · نشر جانب دستگاه + کرانچ نیمکت",
                    "exercises": [
                        {"exId": "standing_lateral_raise_machine", "reps": "3 × 12–20", "sets": 3},
                        {"exId": "bench_crunch", "reps": "3 × 12–20", "sets": 3}
                    ]
                }
            ],
            "singles": [
                {"exId": "back_extension", "reps": "3 × 12–15", "sets": 3}
            ]
        },
        {
            "id": "d4", "title": "سه‌شنبه", "type": "home", "badge": "🏠 خانه",
            "note": "تمرکز بر کنترل کتف، سلامت کمربند شانه‌ای و ثبات زنجیره خلفی در خانه",
            "treadmill": False,
            "supersets": [],
            "singles": [
                {"exId": "wall_slide", "reps": "3 × 8–12", "sets": 3},
                {"exId": "prone_itwy", "reps": "3 × 8–12", "sets": 3},
                {"exId": "push_up_plus", "reps": "3 × 8–15", "sets": 3},
                {"exId": "side_plank_iso", "reps": "3 × 20–40 ثانیه هر طرف", "sets": 3},
                {"exId": "dead_bug", "reps": "3 × 6–10 هر طرف", "sets": 3},
                {"exId": "glute_bridge_iso", "reps": "3 × 20–40 ثانیه", "sets": 3}
            ]
        },
        {
            "id": "d5", "title": "چهارشنبه", "type": "rest", "badge": "🛌 استراحت کامل",
            "note": "استراحت کامل، تغذیه با کیفیت و ریکاوری بافت‌های عضلانی",
            "treadmill": False,
            "supersets": [],
            "singles": []
        },
        {
            "id": "d6", "title": "پنجشنبه", "type": "gym", "badge": "🏋️ باشگاه",
            "note": "۷۵ دقیقه تمرین با وزنه + ۱۵ دقیقه تردمیل در انتهای جلسه · حرکات اصلی حدود 2 RIR",
            "treadmill": True,
            "supersets": [
                {
                    "title": "A1 + A2 · هک اسکوات + ریورس پک‌دک",
                    "exercises": [
                        {"exId": "hack_squat", "reps": "3 × 8–12", "sets": 3},
                        {"exId": "reverse_peck_deck_fly", "reps": "3 × 12–20", "sets": 3}
                    ]
                },
                {
                    "title": "B1 + B2 · پرس سینه دستگاه + پشت پا دستگاه",
                    "exercises": [
                        {"exId": "seated_chest_press_machine", "reps": "3 × 8–12", "sets": 3},
                        {"exId": "leg_curl", "reps": "3 × 10–15", "sets": 3}
                    ]
                },
                {
                    "title": "C1 + C2 · قایقی + پشت بازو بالای سر طناب",
                    "exercises": [
                        {"exId": "cable_row", "reps": "3 × 8–12", "sets": 3},
                        {"exId": "overhead_triceps_extension", "reps": "3 × 10–15", "sets": 3}
                    ]
                },
                {
                    "title": "D1 + D2 · ددلیفت رومانیایی + ابداکشن کابل",
                    "exercises": [
                        {"exId": "rdl", "reps": "2 × 8–12", "sets": 2},
                        {"exId": "cable_hip_abduction", "reps": "3 × 12–20", "sets": 3}
                    ]
                },
                {
                    "title": "E1 + E2 · فلای بالا سینه دستگاه + اداکشن کابل",
                    "exercises": [
                        {"exId": "incline_chest_fly", "reps": "3 × 10–15", "sets": 3},
                        {"exId": "cable_hip_adduction", "reps": "3 × 12–20", "sets": 3}
                    ]
                },
                {
                    "title": "F1 + F2 · همر کرل روی لاری + شراگ دمبل",
                    "exercises": [
                        {"exId": "preacher_hammer_curl", "reps": "3 × 8–12", "sets": 3},
                        {"exId": "dumbbell_shrugs", "reps": "3 × 10–15", "sets": 3}
                    ]
                }
            ],
            "singles": [
                {"exId": "standing_calf_raise_hack", "reps": "3 × 10–15", "sets": 3},
                {"exId": "back_extension", "reps": "3 × 10–15", "sets": 3}
            ]
        },
        {
            "id": "d7", "title": "جمعه", "type": "home", "badge": "🏠 خانه",
            "note": "پایان هفته با تمرینات ثبات عضلات مرکزی، کنترل کمربند شانه‌ای و تمرکز ایزومتریک در خانه",
            "treadmill": False,
            "supersets": [],
            "singles": [
                {"exId": "wall_sit", "reps": "3 × 30–60 ثانیه", "sets": 3},
                {"exId": "side_plank_iso", "reps": "3 × 20–40 ثانیه هر طرف", "sets": 3},
                {"exId": "dead_bug_iso", "reps": "3 × 20–30 ثانیه", "sets": 3},
                {"exId": "iso_bird_dog", "reps": "3 × 20–30 ثانیه هر طرف", "sets": 3},
                {"exId": "wall_slide", "reps": "2 × 10–12", "sets": 2},
                {"exId": "push_up_plus", "reps": "3 × 8–15", "sets": 3}
            ]
        }
    ]
}

with open('template_male.json', 'w', encoding='utf-8') as f:
    json.dump(template_male_profile, f, ensure_ascii=False, indent=2)

print(f'Done! Total master exercises: {len(master_exercises)}')
