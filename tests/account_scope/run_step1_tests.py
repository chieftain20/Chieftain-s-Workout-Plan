"""Account-scope contract-test runner.

Runs every account-scope contract test as a subprocess and compares the actual
result against the result expected at this point in the project.

STEP 2 status: the storage-scope, isolation and no-auto-upload tests pass. The
legacy-import, outbox/conflict and password-recovery tests are expected to FAIL
because those features are deliberately not implemented yet. The runner reports a
mismatch between expected and actual as a failure of the runner itself.

Usage:
    python tests/account_scope/run_step1_tests.py
"""

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# name -> True if the test is expected to PASS at this point in the project
EXPECTED = {
    "test_migration_artifact_contract.py": True,
    "test_preserved_surfaces.py": True,
    "test_preflight_existence_aware.py": True,
    "test_scope_isolation.py": True,
    "test_frontend_scope_contract.py": True,
    "test_no_auto_upload_contract.py": True,
    "test_outbox_engine.py": True,
    "test_outbox_conflict_contract.py": True,
    "test_no_direct_cloud_writes.py": True,
    "test_legacy_import_contract.py": True,
    "test_legacy_import_behaviour.py": True,
    "test_cloud_pull.py": True,
    "test_conflict_ui.py": True,
    "test_password_recovery.py": True,
    "test_email_confirmation.py": True,
    "test_sync_pull_cas.py": True,
    "test_startup_hydration.py": True,
    "test_custom_exercise_pull.py": True,
    "test_e2e_staging_safety.py": True,
}


def run_one(filename: str):
    proc = subprocess.run(
        [sys.executable, filename],
        cwd=str(HERE),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return proc.returncode == 0, (proc.stdout or "") + (proc.stderr or "")


def main() -> int:
    print("=" * 78)
    print("STEP 1 account-scope contract tests")
    print("=" * 78)

    mismatches = []
    for filename, expected_pass in EXPECTED.items():
        actual_pass, output = run_one(filename)
        verdict = "PASS" if actual_pass else "FAIL"
        want = "PASS" if expected_pass else "FAIL (pending a later step)"
        agreed = actual_pass == expected_pass

        print(f"\n--- {filename}")
        for line in output.strip().splitlines():
            print(f"    {line}")
        print(f"    -> actual: {verdict} | expected: {want} | {'ok' if agreed else 'MISMATCH'}")

        if not agreed:
            mismatches.append(filename)

    print("\n" + "=" * 78)
    if mismatches:
        print("RUNNER RESULT: MISMATCH")
        for m in mismatches:
            print(f"  - {m}: actual result differs from the STEP 1 expectation")
        print("=" * 78)
        return 1

    print("RUNNER RESULT: OK -- every test matched its expectation")
    print("  all client-side account-scope tests pass.")
    print("  deferred: anything that requires a real database (migration apply,")
    print("            RLS/RPC behaviour, live auth round trips).")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
