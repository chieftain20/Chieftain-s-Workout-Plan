# -*- coding: utf-8 -*-
import base64

with open('icons/icon-192.png', 'rb') as f:
    b192 = base64.b64encode(f.read()).decode('utf-8')

with open('icons/apple-touch-icon.png', 'rb') as f:
    b_apple = base64.b64encode(f.read()).decode('utf-8')

with open('tmpl_head.html', 'r', encoding='utf-8') as f:
    head_html = f.read()

# Replace the icon links with embedded Base64 icons in head_html
icon_tags = f"""  <!-- Embedded High-Res Icons (Guaranteed No Netlify N Logo) -->
  <link rel="icon" type="image/png" sizes="192x192" href="data:image/png;base64,{b192}">
  <link rel="apple-touch-icon" href="data:image/png;base64,{b_apple}">
  <link rel="apple-touch-icon" sizes="180x180" href="data:image/png;base64,{b_apple}">
  <link rel="shortcut icon" href="data:image/png;base64,{b192}">
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">"""

head_html = head_html.replace('<!-- Icons (Multi-path & High-Res) -->', icon_tags)

with open('tmpl_body.html', 'r', encoding='utf-8') as f:
    body_html = f.read()

with open('tmpl_modals.html', 'r', encoding='utf-8') as f:
    modals_html = f.read()

with open('styles.css', 'r', encoding='utf-8') as f:
    styles_css = f.read()

head_html = head_html.replace('<link rel="stylesheet" href="styles.css">', f'<style>\n{styles_css}\n</style>')

with open('master_exercises.json', 'r', encoding='utf-8') as f:
    master_ex_json = f.read()

with open('template_male.json', 'r', encoding='utf-8') as f:
    template_male_json = f.read()

with open('template_female.json', 'r', encoding='utf-8') as f:
    template_female_json = f.read()

with open('app_engine.js', 'r', encoding='utf-8') as f:
    app_engine_code = f.read()

final_html = f"""{head_html}
{body_html}
{modals_html}

<script>
const MASTER_EXERCISES = {master_ex_json};
const TEMPLATE_MALE_PROFILE = {template_male_json};
const TEMPLATE_FEMALE_PROFILE = {template_female_json};

{app_engine_code}
</script>
</body>
</html>
"""

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(final_html)

print('SUCCESS: index.html generated! Total chars:', len(final_html))
