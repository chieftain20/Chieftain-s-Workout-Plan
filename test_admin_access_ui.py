"""Regression checks for the tucked-away management login UI."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODALS = (ROOT / "tmpl_modals.html").read_text(encoding="utf-8")
ENGINE = (ROOT / "app_engine.js").read_text(encoding="utf-8")
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")

assert 'id="adminAccessRevealBtn"' in MODALS
assert 'onclick="toggleAdminAccessForm(true)"' in MODALS
assert 'id="adminAccessFormSection" style="display:none;' in MODALS
assert MODALS.index('id="adminAccessRevealBtn"') < MODALS.index('id="adminAccessFormSection"')
assert 'id="adminAccessPinInput"' in MODALS

# The normal account modal exposes only the neutral entry action until selected.
visible_modal = MODALS[MODALS.index('<div id="authModal"'):MODALS.index('id="adminAccessFormSection"')]
assert "ورود ادمین ابری و دسترسی محلی آفلاین" not in visible_modal
assert "کد دسترسی" not in visible_modal
assert "Cloud Admin" not in visible_modal

toggle = ENGINE[ENGINE.index("function toggleAdminAccessForm"):ENGINE.index("function switchAuthTab")]
assert "section.style.display = isOpen ? 'block' : 'none'" in toggle
assert "handleAdminPinLogin" not in toggle
assert "pinLower === 'gym' || pinLower === 'haji'" in ENGINE
assert "cloud-admin-login" in ENGINE

# index.html is the deployed app and must contain the assembled UI/runtime change.
assert 'id="adminAccessFormSection" style="display:none;' in INDEX
assert "function toggleAdminAccessForm(forceOpen)" in INDEX
assert "ورود ادمین ابری و دسترسی محلی آفلاین" not in INDEX

print("PASS: management login is hidden until requested; local access and cloud login handlers remain wired.")
