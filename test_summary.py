import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('master_exercises.json', 'r', encoding='utf-8') as f:
    master_ex = json.load(f)

with open('hossein_profile.json', 'r', encoding='utf-8') as f:
    h_prof = json.load(f)

with open('morvarid_profile.json', 'r', encoding='utf-8') as f:
    m_prof = json.load(f)

ex_map = {e['id']: e for e in master_ex}

muscleGroups = [
  { 'key': 'سینه', 'label': 'سینه (Chest)', 'keywords': ['سینه', 'chest', 'pec'] },
  { 'key': 'چهارسر', 'label': 'چهارسر ران (Quads)', 'keywords': ['چهارسر', 'اسکوات', 'پرس پا', 'جلو پا', 'جلو ران', 'squat', 'leg press', 'leg extension', 'hack'] },
  { 'key': 'همسترینگ', 'label': 'همسترینگ (Hamstrings)', 'keywords': ['همسترینگ', 'پشت پا', 'پشت ران', 'ددلیفت', 'rdl', 'deadlift', 'leg curl'] },
  { 'key': 'باسن', 'label': 'سرینی و باسن (Glutes)', 'keywords': ['باسن', 'سرینی', 'هیپ تراست', 'کیک‌بک', 'پل باسن', 'glute', 'hip thrust', 'kickback', 'bridge', 'فایر'] },
  { 'key': 'خارج ران', 'label': 'خارج ران / سرینی میانی (Abductors)', 'keywords': ['خارج ران', 'ابداکشن', 'پوسته صدف', 'abduction', 'clamshell', 'medius', 'هایدرانت'] },
  { 'key': 'داخل ران', 'label': 'داخل ران (Adductors)', 'keywords': ['داخل ران', 'اداکشن', 'قزاقی', 'adduction', 'cossack'] },
  { 'key': 'ساق', 'label': 'ساق پا (Calves)', 'keywords': ['ساق', 'calf', 'calves'] },
  { 'key': 'فیله', 'label': 'فیله و راست‌کننده ستون فقرات (Lower Back)', 'keywords': ['فیله', 'کمر', 'back extension', 'erector'] },
  { 'key': 'پشت', 'label': 'زیر بغل و پشت میانی (Lats & Back)', 'keywords': ['زیر بغل', 'لت', 'پشت میانی', 'قایقی', 'یوفو', 'lat', 'row', 'pulldown'] },
  { 'key': 'سرشانه', 'label': 'سرشانه و دلتوئید (Shoulders)', 'keywords': ['سرشانه', 'شانه', 'نشر', 'پک‌دک معکوس', 'ریورس', 'دلتوئید', 'shoulder', 'lateral raise', 'face pull', 'press'] },
  { 'key': 'جلو بازو', 'label': 'جلو بازو (Biceps)', 'keywords': ['جلو بازو', 'لاری', 'کرل', 'bicep', 'curl'] },
  { 'key': 'پشت بازو', 'label': 'پشت بازو (Triceps)', 'keywords': ['پشت بازو', 'طناب', 'tricep', 'pushdown', 'extension'] },
  { 'key': 'شکم', 'label': 'عضلات مرکزی و شکم (Core & Abs)', 'keywords': ['شکم', 'مورب', 'کرانچ', 'پلانک', 'دیدباگ', 'برد داگ', 'زیرشکم', 'core', 'abs', 'plank', 'bug', 'crunch'] }
]

def check(prof):
    print('Checking:', prof['name'])
    stats = {m['key']: {'label': m['label'], 'sets': 0, 'days': set(), 'exercises': set()} for m in muscleGroups}
    for day in prof['days']:
        if day.get('type') == 'rest': continue
        items = []
        if day.get('singles'): items.extend(day['singles'])
        if day.get('supersets'):
            for ss in day['supersets']: items.extend(ss['exercises'])
        for item in items:
            ex = ex_map.get(item['exId'], {'fa': item['exId'], 'en': '', 'muscles': ''})
            sets = item.get('sets', 3)
            searchTxt = (ex['fa'] + ' ' + (ex.get('en') or '') + ' ' + (ex.get('muscles') or '')).lower()
            for m in muscleGroups:
                if any(kw.lower() in searchTxt for kw in m['keywords']):
                    stats[m['key']]['sets'] += sets
                    stats[m['key']]['days'].add(day['title'])
                    stats[m['key']]['exercises'].add(ex['fa'])
    for m in muscleGroups:
        s = stats[m['key']]
        if s['sets'] > 0:
            print(f"  {s['label']}: {s['sets']} sets | {len(s['days'])} days | {', '.join(s['exercises'])}")

check(h_prof)
print()
check(m_prof)
