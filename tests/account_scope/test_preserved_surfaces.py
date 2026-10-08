"""Preserved-surface guards.

Asserts that the two surfaces this migration must never regress are intact:
the admin authentication mechanism, and the scientific volume model.

EXPECTED STATUS IN STEP 1: PASS. These must keep passing through every
subsequent step; a failure here is a stop-the-line event.
"""

import _common as c


def run() -> c.Contract:
    t = c.Contract("preserved_surfaces")

    js = c.read_text(c.APP_JS_PATH)
    admin_fn = c.read_text(c.ADMIN_FN_PATH)
    science = c.read_text(c.SCIENCE_DOC_PATH)

    # --- admin authentication, client side -----------------------------------
    if t.require(js is not None, "app_engine.js exists"):
        t.require_present(js, "cloud-admin-login", "client calls the cloud-admin-login function")
        t.require_present(js, "verifyOtp", "client exchanges the token via verifyOtp")
        t.require_present(js, "magiclink", "client uses the magiclink token type")
        t.require_absent(js, "ADMIN_ACCESS_CODE", "the admin access code is NOT in client code")
        t.require_present(js, "'gym'", "offline 'gym' admin path preserved")
        t.require_present(js, "'haji'", "offline 'haji' admin path preserved")
        t.require_present(js, "chieftain_admin_pin", "offline admin PIN storage preserved")

    # --- admin authentication, server side -----------------------------------
    if t.require(admin_fn is not None, "cloud-admin-login Edge Function exists"):
        t.require_present(admin_fn, "ADMIN_ACCESS_CODE", "Edge Function still reads ADMIN_ACCESS_CODE")
        t.require_present(admin_fn, "ADMIN_EMAIL", "Edge Function still reads ADMIN_EMAIL")
        t.require_present(admin_fn, "constantTimeEqual", "constant-time comparison preserved")

    # --- scientific volume model ---------------------------------------------
    if t.require(science is not None, "SCIENTIFIC_VOLUME_MODEL.md exists"):
        t.require_present(science, "41343037", "Pelland 2026 meta-regression citation preserved")
        t.require_present(science, "Plotkin", "Plotkin 2023 hip-thrust citation preserved")
        t.require_present(science, "0.5", "fractional 0.5 indirect-set accounting preserved")
        t.require_present(science, "RIR", "RIR-as-quality-variable statement preserved")

    t.require(c.SCIENCE_TEST_PATH.exists(), "the scientific summary test still exists and is runnable")

    return t


if __name__ == "__main__":
    c.main(run)
