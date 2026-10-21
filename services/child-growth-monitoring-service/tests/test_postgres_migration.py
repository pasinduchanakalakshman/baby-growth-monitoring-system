"""Automated and Safe PostgreSQL Migration and Isolation Test Suite.

Verifies:
1. Strict database isolation and safety checks (fail-closed, unmistakable test database name).
2. Safe execution of the complete Alembic migration chain (001 -> 002).
3. Preservation of existing users, babies, and growth measurement records.
4. Strict foreign-key constraint enforcement (rejects nonexistent baby_id).
5. Strict unique constraint: exactly one nutrition preferences record per baby (IntegrityError).
6. Foreign-key cascading: baby deletion cascades to nutrition preferences.
7. Transaction rollback integrity on failed updates.
8. Persistence across database connection/session restarts.
9. Clean downgrade on disposable test data only.

Safety Contract:
- Requires POSTGRES_TEST_DATABASE_URL environment variable.
- Requires ALLOW_POSTGRES_TEST_SCHEMA_MUTATION=true environment variable.
- Database name MUST contain 'test' or 'disposable' and MUST NOT equal 'postgres' or production names.
- Host MUST NOT be a remote production domain.
- Module-level import does NOT mutate any database.
"""

import os
from pathlib import Path
from typing import Optional
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import IntegrityError
from alembic.config import Config
from alembic import command


def get_verified_test_db_url() -> Optional[str]:
    """
    Validates and returns the isolated test database URL.
    Fails closed if the database cannot be guaranteed to be an isolated test environment.
    """
    test_url = os.environ.get("POSTGRES_TEST_DATABASE_URL")
    if not test_url:
        return None

    opt_in = os.environ.get("ALLOW_POSTGRES_TEST_SCHEMA_MUTATION", "").lower()
    if opt_in not in ("1", "true", "yes"):
        raise RuntimeError(
            "SAFETY CHECK FAILED: POSTGRES_TEST_DATABASE_URL is set, but "
            "ALLOW_POSTGRES_TEST_SCHEMA_MUTATION=true is missing. Refusing to mutate schema."
        )

    parsed = make_url(test_url)

    # 1. Database name check: Must contain 'test' or 'disposable'
    db_name = (parsed.database or "").lower()
    if not ("test" in db_name or "disposable" in db_name):
        raise RuntimeError(
            f"SAFETY CHECK FAILED: Database name '{parsed.database}' does not contain 'test' or 'disposable'. "
            "Unsafe database target rejected to prevent accidental mutation of application databases."
        )

    # Disallow bare 'postgres' or production names
    if db_name in ("postgres", "production", "prod", "main", "staging"):
        raise RuntimeError(
            f"SAFETY CHECK FAILED: Database name '{parsed.database}' is a generic/production database name. "
            "A dedicated test database name is required."
        )

    # 2. Host check: Never connect to production domains
    host = (parsed.host or "").lower()
    disallowed_hosts = ["supabase.co", "rds.amazonaws.com", "azure.com", "cockroachlabs.cloud"]
    for dh in disallowed_hosts:
        if dh in host:
            raise RuntimeError(
                f"SAFETY CHECK FAILED: Host '{parsed.host}' matches production cloud provider. "
                "Refusing to execute migration tests against remote host."
            )

    return test_url


def test_isolated_postgres_migration_and_constraints():
    """
    Executes the full, safe migration cycle and schema constraint tests on an isolated PostgreSQL database.
    Skipped if POSTGRES_TEST_DATABASE_URL is not set.
    """
    test_url = get_verified_test_db_url()
    if not test_url:
        pytest.skip("POSTGRES_TEST_DATABASE_URL not set; skipping isolated PostgreSQL migration test.")

    engine = create_engine(test_url)

    # -------------------------------------------------------------------------
    # 1. Clean disposable test schema (Guaranteed isolated test DB only)
    # -------------------------------------------------------------------------
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS baby_nutrition_preferences CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS growth_measurements CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS babies CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE;"))

        # Create pre-migration schema: users (without auth fields), babies, growth_measurements
        conn.execute(text("""
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR UNIQUE NOT NULL,
                name VARCHAR,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        conn.execute(text("""
            CREATE TABLE babies (
                id SERIAL PRIMARY KEY,
                owner_id INTEGER REFERENCES users(id) NOT NULL,
                name VARCHAR NOT NULL,
                sex VARCHAR NOT NULL,
                date_of_birth DATE NOT NULL,
                birth_weight_kg DOUBLE PRECISION NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))
        conn.execute(text("""
            CREATE TABLE growth_measurements (
                id SERIAL PRIMARY KEY,
                baby_id INTEGER REFERENCES babies(id) NOT NULL,
                visit_date DATE NOT NULL,
                weight_kg DOUBLE PRECISION NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """))

        # Seed pre-existing records to verify data preservation across migrations
        conn.execute(text("INSERT INTO users (id, email, name) VALUES (1, 'parent1@test.com', 'Parent One');"))
        conn.execute(text("INSERT INTO babies (id, owner_id, name, sex, date_of_birth, birth_weight_kg) VALUES (1, 1, 'Baby One', 'Male', '2026-03-20', 3.2);"))
        conn.execute(text("INSERT INTO growth_measurements (baby_id, visit_date, weight_kg) VALUES (1, '2026-04-20', 4.1);"))

    # -------------------------------------------------------------------------
    # 2. Run Alembic Upgrade to HEAD (Chain: 001_add_auth_fields -> 002_add_nutrition_preferences)
    # -------------------------------------------------------------------------
    orig_env_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = test_url
    alembic_ini_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    alembic_cfg = Config(str(alembic_ini_path))
    alembic_cfg.set_main_option("sqlalchemy.url", test_url.replace("%", "%%"))

    try:
        command.upgrade(alembic_cfg, "head")
    finally:
        if orig_env_db is not None:
            os.environ["DATABASE_URL"] = orig_env_db

    with engine.connect() as conn:
        # Verify table exists in PostgreSQL information_schema
        table_exists = conn.execute(text(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'baby_nutrition_preferences';"
        )).scalar()
        assert table_exists == 1, "Table 'baby_nutrition_preferences' was not created by migration upgrade."

        # Verify alembic_version is at revision 002_add_nutrition_preferences
        current_rev = conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
        assert current_rev == "002_add_nutrition_preferences", f"Unexpected alembic revision: {current_rev}"

        # ---------------------------------------------------------------------
        # 3. Existing User, Baby, and Growth Measurement Preservation Check
        # ---------------------------------------------------------------------
        user_row = conn.execute(text("SELECT email, password_hash, is_active FROM users WHERE id = 1;")).fetchone()
        assert user_row is not None
        assert user_row[0] == "parent1@test.com"
        assert user_row[1] == "legacy"  # 001 migration updated existing users to 'legacy'
        assert user_row[2] is True

        baby_row = conn.execute(text("SELECT name, birth_weight_kg FROM babies WHERE id = 1;")).fetchone()
        assert baby_row is not None
        assert baby_row[0] == "Baby One"
        assert baby_row[1] == 3.2

        growth_row = conn.execute(text("SELECT weight_kg FROM growth_measurements WHERE baby_id = 1;")).fetchone()
        assert growth_row is not None
        assert growth_row[0] == 4.1

        # ---------------------------------------------------------------------
        # 4. Strict Foreign-Key Enforcement (Reject invalid baby_id)
        # ---------------------------------------------------------------------
        with pytest.raises(IntegrityError) as fk_exc:
            with conn.begin_nested():
                conn.execute(text("""
                    INSERT INTO baby_nutrition_preferences (
                        baby_id, foods_introduced, restricted_foods, available_ingredients,
                        dietary_preferences, recent_meal_history, only_available_ingredients
                    ) VALUES (
                        999999, '[]'::json, '[]'::json, '[]'::json, '[]'::json, '[]'::json, false
                    );
                """))
        assert "foreign key" in str(fk_exc.value).lower() or "violates foreign key constraint" in str(fk_exc.value).lower()

        # ---------------------------------------------------------------------
        # 5. One Preference Record Per Baby (Strict Unique Constraint)
        # ---------------------------------------------------------------------
        # Insert initial valid preference for Baby 1
        conn.execute(text("""
            INSERT INTO baby_nutrition_preferences (
                baby_id, foods_introduced, restricted_foods, available_ingredients,
                dietary_preferences, recent_meal_history, only_available_ingredients
            ) VALUES (
                1, '["ING_RICE_WHITE"]'::json, '[]'::json, '[]'::json, '["VEGETARIAN"]'::json, '[]'::json, false
            );
        """))
        conn.commit()

        # Attempt to insert a second preference record for Baby 1 (MUST raise IntegrityError on uniqueness)
        with pytest.raises(IntegrityError) as uniq_exc:
            with conn.begin_nested():
                conn.execute(text("""
                    INSERT INTO baby_nutrition_preferences (
                        baby_id, foods_introduced, restricted_foods, available_ingredients,
                        dietary_preferences, recent_meal_history, only_available_ingredients
                    ) VALUES (
                        1, '["ING_DHAL"]'::json, '[]'::json, '[]'::json, '[]'::json, '[]'::json, false
                    );
                """))
        assert "unique" in str(uniq_exc.value).lower() or "ix_baby_nutrition_preferences_baby_id" in str(uniq_exc.value).lower() or "uq_baby_nutrition_preferences_baby_id" in str(uniq_exc.value).lower()

        # ---------------------------------------------------------------------
        # 6. Preference Update Rollback Integrity
        # ---------------------------------------------------------------------
        # Execute update inside a savepoint and explicitly roll it back
        savepoint = conn.begin_nested()
        conn.execute(text("""
            UPDATE baby_nutrition_preferences
            SET dietary_preferences = '["NON_VEGETARIAN"]'::json
            WHERE baby_id = 1;
        """))
        savepoint.rollback()

        # Verify rollback preserved original value
        pref_after_rollback = conn.execute(text(
            "SELECT dietary_preferences FROM baby_nutrition_preferences WHERE baby_id = 1;"
        )).scalar()
        assert pref_after_rollback == ["VEGETARIAN"], f"Rollback failed; found {pref_after_rollback}"

        # ---------------------------------------------------------------------
        # 7. Persistence Across Database Connection/Session Restart
        # ---------------------------------------------------------------------
        # Commit updated data
        conn.execute(text("""
            UPDATE baby_nutrition_preferences
            SET dietary_preferences = '["VEGETARIAN", "HALAL"]'::json
            WHERE baby_id = 1;
        """))
        conn.commit()

    # Dispose of engine to simulate complete backend shutdown
    engine.dispose()

    # Reconnect with fresh engine and verify persistence
    fresh_engine = create_engine(test_url)
    with fresh_engine.connect() as fresh_conn:
        reloaded = fresh_conn.execute(text(
            "SELECT dietary_preferences FROM baby_nutrition_preferences WHERE baby_id = 1;"
        )).scalar()
        assert reloaded == ["VEGETARIAN", "HALAL"], f"Data not persisted across session restart: {reloaded}"

        # ---------------------------------------------------------------------
        # 8. Foreign-Key Cascade on Baby Deletion
        # ---------------------------------------------------------------------
        # Insert dedicated baby 2 and preferences to test cascade deletion without touching baby 1 records
        fresh_conn.execute(text(
            "INSERT INTO babies (id, owner_id, name, sex, date_of_birth, birth_weight_kg) "
            "VALUES (2, 1, 'Baby Two', 'Female', '2026-05-01', 3.0);"
        ))
        fresh_conn.execute(text("""
            INSERT INTO baby_nutrition_preferences (
                baby_id, foods_introduced, restricted_foods, available_ingredients,
                dietary_preferences, recent_meal_history, only_available_ingredients
            ) VALUES (
                2, '["ING_RICE_WHITE"]'::json, '[]'::json, '[]'::json, '[]'::json, '[]'::json, false
            );
        """))
        fresh_conn.commit()

        # Delete baby 2 and assert its preferences row is automatically removed via ON DELETE CASCADE
        fresh_conn.execute(text("DELETE FROM babies WHERE id = 2;"))
        fresh_conn.commit()

        orphan_prefs_count = fresh_conn.execute(text(
            "SELECT count(*) FROM baby_nutrition_preferences WHERE baby_id = 2;"
        )).scalar()
        assert orphan_prefs_count == 0, f"Expected 0 orphan preferences after baby 2 deletion, found {orphan_prefs_count}"

        # Baby 1 preferences and growth measurements remain intact
        baby1_prefs = fresh_conn.execute(text(
            "SELECT count(*) FROM baby_nutrition_preferences WHERE baby_id = 1;"
        )).scalar()
        assert baby1_prefs == 1, "Baby 1 preferences were unexpectedly modified."

    # -------------------------------------------------------------------------
    # 9. Downgrade Verification on Disposable Test Data
    # -------------------------------------------------------------------------
    orig_env_db = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = test_url
    try:
        command.downgrade(alembic_cfg, "001_add_auth_fields")
    finally:
        if orig_env_db is not None:
            os.environ["DATABASE_URL"] = orig_env_db

    with fresh_engine.connect() as post_down_conn:
        table_exists_after = post_down_conn.execute(text(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'baby_nutrition_preferences';"
        )).scalar()
        assert table_exists_after is None, "Table 'baby_nutrition_preferences' was not dropped by downgrade."

        # Core tables must still exist intact
        users_exist = post_down_conn.execute(text("SELECT count(*) FROM users;")).scalar()
        assert users_exist == 1, "Users table corrupted by downgrade."

        rev_after_down = post_down_conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
        assert rev_after_down == "001_add_auth_fields", f"Unexpected revision after downgrade: {rev_after_down}"

    fresh_engine.dispose()
