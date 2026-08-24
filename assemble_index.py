# -*- coding: utf-8 -*-
with open('tmpl_head.html', 'r', encoding='utf-8') as f:
    head_html = f.read()

with open('tmpl_body.html', 'r', encoding='utf-8') as f:
    body_html = f.read()

with open('tmpl_modals.html', 'r', encoding='utf-8') as f:
    modals_html = f.read()

with open('master_exercises.json', 'r', encoding='utf-8') as f:
    master_ex_json = f.read()

with open('hossein_profile.json', 'r', encoding='utf-8') as f:
    hossein_prof_json = f.read()

with open('app_engine.js', 'r', encoding='utf-8') as f:
    app_engine_code = f.read()

final_html = f"""{head_html}
{body_html}
{modals_html}

<script>
const MASTER_EXERCISES = {master_ex_json};
const HOSSEIN_PROFILE = {hossein_prof_json};

{app_engine_code}
</script>
</body>
</html>
"""

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(final_html)

print('SUCCESS: index.html generated! Total chars:', len(final_html))
