"""Opt-in live integration test for the deployed Cloud Admin Login function.

Requires SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_ACCESS_CODE, and ADMIN_EMAIL.
The correct-code request can create the configured Auth user on first use or
refresh its admin app_metadata role. This test does not write app table data.
It sends exactly one deliberately wrong code before the correct code; a
successful correct-code request clears that one failure in the function.
"""

import json
import os
import re
import secrets
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen


class LiveTestFailure(Exception):
    """An expected integration-test failure safe to print without credentials."""


UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
FUNCTION_NAME = "cloud-admin-login"
TIMEOUT_SECONDS = 25


def required_env(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise LiveTestFailure(f"Required environment variable is missing: {name}")
    return value


def read_json_response(url, *, method="GET", headers, payload=None, label):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.status, response.read()
    except HTTPError as error:
        return error.code, error.read()
    except (URLError, TimeoutError, OSError) as error:
        # Do not include request bodies, headers, or raw server responses here.
        raise LiveTestFailure(f"{label}: request failed ({type(error).__name__})") from None


def parse_json(body, label):
    try:
        value = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError, TypeError):
        raise LiveTestFailure(f"{label}: server returned invalid JSON") from None
    if not isinstance(value, dict):
        raise LiveTestFailure(f"{label}: server returned an unexpected response")
    return value


def run_live_test():
    supabase_url = required_env("SUPABASE_URL").rstrip("/")
    anon_key = required_env("SUPABASE_ANON_KEY")
    admin_code = required_env("ADMIN_ACCESS_CODE")
    admin_email = required_env("ADMIN_EMAIL").lower()
    if len(admin_code) < 32:
        raise LiveTestFailure("ADMIN_ACCESS_CODE must be at least 32 characters")

    parsed_url = urlsplit(supabase_url)
    if parsed_url.scheme != "https" or not parsed_url.netloc or parsed_url.path not in ("", "/"):
        raise LiveTestFailure("SUPABASE_URL must be an HTTPS Supabase project URL")

    public_headers = {
        "apikey": anon_key,
        "Content-Type": "application/json",
    }
    function_url = f"{supabase_url}/functions/v1/{FUNCTION_NAME}"

    # One wrong attempt mirrors the function's documented 401 path and avoids
    # accumulating failures that could invoke its per-instance rate limit.
    wrong_code = "live-test-invalid-" + secrets.token_urlsafe(24)
    if secrets.compare_digest(wrong_code, admin_code):
        wrong_code += "-not-admin-code"
    wrong_status, _ = read_json_response(
        function_url,
        method="POST",
        headers=public_headers,
        payload={"code": wrong_code},
        label="Wrong-code check",
    )
    if wrong_status != 401:
        raise LiveTestFailure(
            f"Wrong-code check expected HTTP 401, received HTTP {wrong_status}; stopping without retry"
        )
    print("PASS: one intentionally wrong code was rejected with HTTP 401.")

    # The function creates/gets the configured Auth user and issues one
    # single-use magic-link token hash; do not print the request or response.
    success_status, success_body = read_json_response(
        function_url,
        method="POST",
        headers=public_headers,
        payload={"code": admin_code},
        label="Correct-code check",
    )
    if success_status != 200:
        raise LiveTestFailure(f"Correct-code check expected HTTP 200, received HTTP {success_status}")
    issued = parse_json(success_body, "Correct-code check")
    if set(issued) != {"token_hash", "type"}:
        raise LiveTestFailure("Function response had unexpected fields; expected only token_hash and type")
    token_hash = issued.get("token_hash")
    verification_type = issued.get("type")
    if not isinstance(token_hash, str) or not token_hash:
        raise LiveTestFailure("Function response did not contain a token hash")
    if verification_type != "magiclink":
        raise LiveTestFailure("Function returned an unexpected verification type")
    print("PASS: correct code returned a magic-link token hash without extra response fields.")

    # Mirrors app_engine.js: supabase.auth.verifyOtp({token_hash, type:'magiclink'}).
    # Supabase JS posts these fields to /auth/v1/verify; its client sends the
    # project anon key in apikey and as the pre-session Authorization bearer.
    otp_status, otp_body = read_json_response(
        f"{supabase_url}/auth/v1/verify",
        method="POST",
        headers={
            **public_headers,
            "Authorization": f"Bearer {anon_key}",
        },
        payload={"token_hash": token_hash, "type": verification_type},
        label="Magic-link exchange",
    )
    if otp_status != 200:
        raise LiveTestFailure(f"Magic-link exchange expected HTTP 200, received HTTP {otp_status}")
    session_response = parse_json(otp_body, "Magic-link exchange")
    access_token = session_response.get("access_token")
    refresh_token = session_response.get("refresh_token")
    token_type = session_response.get("token_type")
    user_from_exchange = session_response.get("user")
    if (
        not isinstance(access_token, str)
        or not access_token
        or not isinstance(refresh_token, str)
        or not refresh_token
        or token_type != "bearer"
        or not isinstance(user_from_exchange, dict)
    ):
        raise LiveTestFailure("Magic-link exchange did not return a usable Auth session")

    authenticated_headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    user_status, user_body = read_json_response(
        f"{supabase_url}/auth/v1/user",
        headers=authenticated_headers,
        label="Session identity check",
    )
    if user_status != 200:
        raise LiveTestFailure(f"Session identity check expected HTTP 200, received HTTP {user_status}")
    user = parse_json(user_body, "Session identity check")
    user_id = user.get("id")
    if not isinstance(user_id, str) or not UUID_RE.fullmatch(user_id):
        raise LiveTestFailure("Authenticated user ID is not a UUID")
    if not isinstance(user.get("email"), str) or user["email"].strip().lower() != admin_email:
        raise LiveTestFailure("Authenticated email does not match ADMIN_EMAIL")
    app_metadata = user.get("app_metadata")
    if not isinstance(app_metadata, dict) or app_metadata.get("role") != "admin":
        raise LiveTestFailure("Authenticated user is missing app_metadata.role=admin")
    if user_from_exchange.get("id") != user_id:
        raise LiveTestFailure("OTP response user and authenticated session user do not match")
    print("PASS: OTP exchange established a real session for the configured UUID/email/admin role.")

    # Safe, self-filtered read only. It may return no rows for a first login;
    # the app normally creates its profile during browser session handling.
    query = urlencode({"select": "id", "id": f"eq.{user_id}", "limit": "1"})
    profile_status, profile_body = read_json_response(
        f"{supabase_url}/rest/v1/profiles?{query}",
        headers=authenticated_headers,
        label="Authenticated profiles read",
    )
    if profile_status != 200:
        raise LiveTestFailure(
            f"Authenticated self-profile read expected HTTP 200, received HTTP {profile_status}"
        )
    try:
        profiles = json.loads(profile_body)
    except (json.JSONDecodeError, UnicodeDecodeError, TypeError):
        raise LiveTestFailure("Authenticated profiles read returned invalid JSON") from None
    if not isinstance(profiles, list) or any(
        not isinstance(profile, dict) or profile.get("id") != user_id for profile in profiles
    ):
        raise LiveTestFailure("Authenticated profiles read returned an unexpected result")
    print("PASS: authenticated self-filtered profiles read succeeded; no app-table writes were made.")


def main():
    try:
        run_live_test()
    except LiveTestFailure as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    except Exception as error:
        # Keep tracebacks and arbitrary exception text from exposing request data.
        print(f"FAIL: unexpected error ({type(error).__name__})", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
