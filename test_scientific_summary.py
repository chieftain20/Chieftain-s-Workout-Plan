"""Behavioral regression checks for Chieftain's fractional weekly volume model."""
import json
import re
import shutil
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JS = (ROOT / "app_engine.js").read_text(encoding="utf-8")
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
MASTER = json.loads((ROOT / "master_exercises.json").read_text(encoding="utf-8"))
NODE = shutil.which("node")
assert NODE, "Node.js is required for behavior and syntax checks."

mapping_start = JS.index("const EXERCISE_MUSCLE_MAPPING = {")
mapping_end = JS.index("};\n\n// Exercises whose primary purpose", mapping_start) + 2
mapping_block = JS[mapping_start:mapping_end]
MAPPED_IDS = set(re.findall(r"^\s*'([^']+)'\s*:\s*\{", mapping_block, re.M))
MASTER_IDS = {e["id"] for e in MASTER}
WEIGHTS = [float(x) for x in re.findall(r":\s*([01](?:\.\d+)?)\s*[,}]", mapping_block)]

assert MASTER_IDS <= MAPPED_IDS, f"Unmapped master exercises: {sorted(MASTER_IDS - MAPPED_IDS)}"
assert WEIGHTS and all(w in (0.5, 1.0) for w in WEIGHTS), f"Unexpected weights: {sorted(set(WEIGHTS))}"
assert "'dumbbell_shrugs': {'کول': 1}" in mapping_block
assert "'push_up_plus': {'سراتوس قدامی': 1}" in mapping_block
for rdl_id in ("rdl", "dumbbell_rdl", "single_leg_dumbbell_rdl"):
    expected = f"'{rdl_id}': {{'همسترینگ': 1, 'باسن': .5, 'فیله': .5}}"
    assert expected in mapping_block, f"Unexpected contribution mapping for {rdl_id}"
for bridge_id in ("hip_thrust", "glute_bridge", "glute_bridge_iso", "glute_bridge_knees_out", "single_leg_glute_bridge"):
    bridge_entry = re.search(rf"'{bridge_id}': \{{([^}}]+)\}}", mapping_block)
    assert bridge_entry, f"Missing contribution mapping for {bridge_id}"
    assert "'باسن': 1" in bridge_entry.group(1), f"{bridge_id} must count glutes as direct"
    assert "'همسترинг'" not in bridge_entry.group(1), f"{bridge_id} must not count hamstrings"
assert "'push_up_plus'" in JS[JS.index("const STABILITY_EXERCISES"):JS.index("function formatVolumeNumber")]
assert "'dead_bug'" in JS and "'wall_slide'" in JS and "'bird_dog'" in JS
assert "'./index.html'" in SW and "'./app_engine.js'" in SW

render_start = JS.index("function renderDynamicWeeklySummary")
muscle_groups_start = JS.index("const muscleGroups = isEn ? [", render_start)
muscle_groups_end = JS.index("  ];", muscle_groups_start) + 4
muscle_keys = set(re.findall(r"key:\s*'([^']+)'", JS[muscle_groups_start:muscle_groups_end]))
mapping_muscles = set(re.findall(r"'([^']+)':\s*(?:1|\.5)", mapping_block))
assert mapping_muscles <= muscle_keys, f"Muscle labels missing from Summary: {sorted(mapping_muscles - muscle_keys)}"

constants_and_mapping = JS[JS.index("const DIRECT_SET_WEIGHT = 1.0;"):JS.index("function formatVolumeNumber")]
calculator = JS[JS.index("function calculateWeeklyMuscleStats"):JS.index("function renderDynamicWeeklySummary")]
assert "rir" not in calculator.lower(), "RIR must not affect set-volume arithmetic."
behavior_script = constants_and_mapping + calculator + r"""
globalThis.calculate = calculateWeeklyMuscleStats;
globalThis.map = EXERCISE_MUSCLE_MAPPING;
globalThis.stability = STABILITY_EXERCISES;
"""

node_script = behavior_script + r"""
const groups = [...new Set(Object.values(map).flatMap(Object.keys))].map(key => ({key, label:key}));
const lookup = id => ({id, fa:id, en:id, defaultReps:'3 × 10'});
const parseSets = (_reps, fallback) => Number(fallback) || 0;
const profile = days => ({days});
const item = (exId, sets) => ({exId, sets, reps:'3 × 10', rir:2});
const result = calculate(profile([{id:'a',title:'A',type:'gym',singles:[item('peck_deck_fly',3)]}]), groups, lookup, parseSets).stats;
if (result['سینه'].directSets !== 3 || result['سینه'].effectiveSets !== 3) throw Error('3 direct sets must equal 3 effective sets');

const indirect = calculate(profile([{id:'a',title:'A',type:'gym',singles:[item('hack_squat',3)]}]), groups, lookup, parseSets).stats;
if (indirect['باسن'].indirectSets !== 3 || indirect['باسن'].effectiveSets !== 1.5) throw Error('3 secondary sets must equal 1.5 effective sets');

const rdlStats = calculate(profile([{id:'a',title:'A',type:'gym',singles:[item('rdl',3)]}]), groups, lookup, parseSets).stats;
if (rdlStats['همسترینگ'].directSets !== 3 || rdlStats['همسترینگ'].indirectSets !== 0 || rdlStats['همسترینگ'].effectiveSets !== 3) throw Error('RDL hamstrings must count as direct');
if (rdlStats['باسن'].directSets !== 0 || rdlStats['باسن'].indirectSets !== 3 || rdlStats['باسن'].effectiveSets !== 1.5) throw Error('RDL glutes must count as indirect');
if (rdlStats['فیله'].directSets !== 0 || rdlStats['فیله'].indirectSets !== 3 || rdlStats['فیله'].effectiveSets !== 1.5) throw Error('RDL erectors must count as indirect');

const bridgeStats = calculate(profile([{id:'a',title:'A',type:'gym',singles:[item('single_leg_glute_bridge',3)]}]), groups, lookup, parseSets).stats;
if (bridgeStats['باسن'].directSets !== 3 || bridgeStats['همسترینگ'].directSets !== 0 || bridgeStats['همسترینگ'].indirectSets !== 0) throw Error('Single-leg glute bridge must count glutes only');

const thrustStats = calculate(profile([{id:'a',title:'A',type:'gym',singles:[item('hip_thrust',3)]}]), groups, lookup, parseSets).stats;
if (thrustStats['باسن'].directSets !== 3 || thrustStats['همسترینگ'].directSets !== 0 || thrustStats['همسترینگ'].indirectSets !== 0) throw Error('Hip thrust must count glutes only');

const stability = calculate(profile([{id:'a',title:'A',type:'home',singles:[item('push_up_plus',3)]}]), groups, lookup, parseSets);
if (stability.overallStabilitySets !== 3 || stability.stats['سراتوس قدامی'].stabilitySets !== 3 || stability.stats['سراتوس قدامی'].effectiveSets !== 0) throw Error('Push-up plus must remain stability-only');

const locations = calculate(profile([
  {id:'gym-day',title:'Gym',type:'gym',singles:[item('hip_thrust',3)]},
  {id:'home-day',title:'Home',type:'home',singles:[item('hip_thrust',2)]}
]), groups, lookup, parseSets).stats['باسن'];
if (locations.gymSets !== 3 || locations.homeSets !== 2 || locations.gymEffectiveSets !== 3 || locations.homeEffectiveSets !== 2) throw Error('Gym and Home sets must stay separate');
if (locations.days.size !== 2) throw Error('Frequency must count distinct training days');

const exposureStats = calculate(profile([
  {id:'gym-day',title:'Gym',type:'gym',singles:[item('hip_thrust',2), item('dead_bug',1)]},
  {id:'home-day',title:'Home',type:'home',singles:[item('dead_bug',2)]}
]), groups, lookup, parseSets).stats;
if (exposureStats['باسن'].days.size !== 1 || exposureStats['شکم'].days.size !== 0 || exposureStats['شکم'].stabilityDays.size !== 2) throw Error('Hypertrophy and stability frequency must remain distinct');
console.log('PASS: direct, indirect, stability, location, and frequency calculations.');
"""
result = subprocess.run([NODE, "-e", node_script], capture_output=True, text=True, encoding="utf-8")
assert result.returncode == 0, result.stdout + result.stderr
print(result.stdout.strip())


class ScriptParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.blocks = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            values = dict(attrs)
            if "src" not in values and values.get("type", "text/javascript") in ("text/javascript", "application/javascript"):
                self.current = []

    def handle_data(self, data):
        if self.current is not None:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.current is not None:
            self.blocks.append("".join(self.current))
            self.current = None


with tempfile.TemporaryDirectory() as temp:
    paths = [ROOT / "app_engine.js"]
    parser = ScriptParser()
    parser.feed(HTML)
    for i, block in enumerate(parser.blocks):
        path = Path(temp) / f"inline-{i}.js"
        path.write_text(block, encoding="utf-8")
        paths.append(path)
    for path in paths:
        checked = subprocess.run([NODE, "--check", str(path)], capture_output=True, text=True, encoding="utf-8")
        assert checked.returncode == 0, f"JavaScript syntax error in {path.name}:\n{checked.stderr}"
print("PASS: app_engine.js and generated inline JavaScript have no syntax errors.")
