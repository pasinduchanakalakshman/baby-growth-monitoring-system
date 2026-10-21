"""Safe standalone runner for isolated PostgreSQL migration test.

Enforces:
1. Rejects execution if POSTGRES_TEST_DATABASE_URL is not set (fails closed).
2. Rejects execution if ALLOW_POSTGRES_TEST_SCHEMA_MUTATION=true is not set.
3. Rejects execution if database name does not contain 'test' or 'disposable'.
4. Rejects execution if database name matches generic/production names ('postgres', 'production', etc.).
5. Rejects execution if host matches remote production cloud providers.
6. Executes through pytest or the safe test_isolated_postgres_migration_and_constraints function.
7. Never drops tables or runs migrations on unverified or production databases.
"""

import sys
import os
from pathlib import Path

# Add child-growth-monitoring-service to sys.path
service_dir = Path(__file__).resolve().parent / "services" / "child-growth-monitoring-service"
if not service_dir.exists():
    service_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(service_dir))

from tests.test_postgres_migration import (
    get_verified_test_db_url,
    test_isolated_postgres_migration_and_constraints,
)

if __name__ == "__main__":
    print("--- Safe PostgreSQL Migration Test Runner ---")
    try:
        test_url = get_verified_test_db_url()
    except Exception as e:
        print(f"SAFETY VALIDATION ERROR: {e}")
        sys.exit(1)

    if not test_url:
        print("NOTICE: Isolated PostgreSQL migration test was NOT EXECUTED.")
        print("Reason: POSTGRES_TEST_DATABASE_URL environment variable is not set.")
        print("Safety Policy: The test fails closed and will never fall back to an existing application database.")
        print("\nTo execute on an explicitly isolated disposable test database, configure:")
        print("  $env:POSTGRES_TEST_DATABASE_URL = 'postgresql+psycopg://<user>:<password>@<host>:<port>/<test_db_name>'")
        print("  $env:ALLOW_POSTGRES_TEST_SCHEMA_MUTATION = 'true'")
        print("Where <test_db_name> contains 'test' or 'disposable'.")
        sys.exit(0)

    print(f"Verified isolated test database target: {test_url}")
    print("Running migration, constraint, preservation, cascade, and downgrade tests...")
    try:
        test_isolated_postgres_migration_and_constraints()
        print("SUCCESS: All safe PostgreSQL migration and isolation tests PASSED!")
    except Exception as exc:
        print(f"FAILED: PostgreSQL migration test failed: {exc}")
        sys.exit(1)
