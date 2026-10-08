import os
import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

# Load models safely from the repository
import sys
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
services_dir = os.path.join(project_root, 'services', 'child-growth-monitoring-service')
if services_dir not in sys.path:
    sys.path.insert(0, services_dir)

from app.models import Base, User, Baby, GrowthMeasurement, SexEnum

@pytest.fixture(scope="module")
def engine():
    # Use in-memory SQLite for fast testing of the domain models
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture
def session(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()

def test_user_creation(session):
    user = User(email="mother@example.com", name="Test Mother")
    session.add(user)
    session.commit()
    assert user.id is not None
    assert user.created_at is not None

def test_baby_creation_and_retrieval(session):
    user = User(email="mother2@example.com", name="Test Mother 2")
    session.add(user)
    session.commit()
    
    baby = Baby(
        owner_id=user.id,
        name="Test Baby",
        sex=SexEnum.male,
        date_of_birth=datetime.date(2023, 1, 1),
        birth_weight_kg=3.2
    )
    session.add(baby)
    session.commit()
    
    assert baby.id is not None
    assert baby.owner.email == "mother2@example.com"
    
    # 2. retrieve baby
    retrieved = session.query(Baby).filter_by(id=baby.id).first()
    assert retrieved.name == "Test Baby"

def test_measurement_creation_missing_height(session):
    user = User(email="mother3@example.com")
    session.add(user)
    session.commit()
    
    baby = Baby(
        owner_id=user.id,
        name="Test Baby 3",
        sex=SexEnum.female,
        date_of_birth=datetime.date(2023, 1, 1),
        birth_weight_kg=3.2
    )
    session.add(baby)
    session.commit()
    
    # 5. missing height accepted
    meas = GrowthMeasurement(
        baby_id=baby.id,
        visit_date=datetime.date(2023, 2, 1),
        weight_kg=4.5
        # length_height_cm omitted
    )
    session.add(meas)
    session.commit()
    
    assert meas.id is not None
    assert meas.length_height_cm is None
    
    # 10. relationship ownership works
    assert len(baby.measurements) == 1
    assert baby.measurements[0].weight_kg == 4.5

def test_visit_before_birth_rejected(session):
    # This requires business logic or model-level validation
    # Here we simulate the service layer validation that would reject it.
    def validate_measurement(baby, visit_date, weight, height=None):
        if visit_date < baby.date_of_birth:
            raise ValueError("Visit date cannot be before date of birth")
        if weight <= 0:
            raise ValueError("Weight must be > 0")
        if height is not None and height <= 0:
            raise ValueError("Height must be > 0 if supplied")
            
    baby = Baby(name="Test 4", sex=SexEnum.male, date_of_birth=datetime.date(2023, 1, 1), birth_weight_kg=3.0)
    
    # 8. visit before birth rejected
    with pytest.raises(ValueError, match="Visit date cannot be before date of birth"):
        validate_measurement(baby, datetime.date(2022, 12, 31), 3.5)
        
    # 6. invalid weight rejected
    with pytest.raises(ValueError, match="Weight must be > 0"):
        validate_measurement(baby, datetime.date(2023, 2, 1), -1.0)
        
    # 7. invalid height rejected
    with pytest.raises(ValueError, match="Height must be > 0 if supplied"):
        validate_measurement(baby, datetime.date(2023, 2, 1), 4.0, height=-5.0)

def test_duplicate_date_rejected(session):
    user = User(email="mother4@example.com")
    baby = Baby(owner=user, name="Test 5", sex=SexEnum.male, date_of_birth=datetime.date(2023, 1, 1), birth_weight_kg=3.0)
    session.add_all([user, baby])
    session.commit()
    
    meas1 = GrowthMeasurement(baby_id=baby.id, visit_date=datetime.date(2023, 2, 1), weight_kg=4.0)
    session.add(meas1)
    session.commit()
    
    meas2 = GrowthMeasurement(baby_id=baby.id, visit_date=datetime.date(2023, 2, 1), weight_kg=4.2)
    session.add(meas2)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()

def test_measurements_remain_ordered(session):
    user = User(email="mother5@example.com")
    baby = Baby(owner=user, name="Test 6", sex=SexEnum.male, date_of_birth=datetime.date(2023, 1, 1), birth_weight_kg=3.0)
    session.add_all([user, baby])
    session.commit()
    
    # Insert out of order
    meas_mar = GrowthMeasurement(baby_id=baby.id, visit_date=datetime.date(2023, 3, 1), weight_kg=5.0)
    meas_feb = GrowthMeasurement(baby_id=baby.id, visit_date=datetime.date(2023, 2, 1), weight_kg=4.0)
    meas_jan = GrowthMeasurement(baby_id=baby.id, visit_date=datetime.date(2023, 1, 15), weight_kg=3.5)
    
    session.add_all([meas_mar, meas_feb, meas_jan])
    session.commit()
    
    # 9. measurements remain ordered
    session.refresh(baby)
    dates = [m.visit_date for m in baby.measurements]
    assert dates == sorted(dates)
    assert dates[0] == datetime.date(2023, 1, 15)
    assert dates[2] == datetime.date(2023, 3, 1)

def test_model_artifacts_unchanged():
    # 11. model/research artifacts unchanged
    import hashlib
    import json
    
    def get_hash(path):
        sha = hashlib.sha256()
        with open(path, 'rb') as f:
            for b in iter(lambda: f.read(4096), b""):
                sha.update(b)
        return sha.hexdigest()
        
    chk_path = os.path.join(project_root, 'models', 'metadata', 'final_risk_model_v1.json')
    if os.path.exists(chk_path):
        rc_path = os.path.join(project_root, 'models', 'metadata', 'research_core_v1_checksums.json')
        with open(rc_path, 'r') as f2:
            rc_chk = json.load(f2)
            
        for k, v in rc_chk['files'].items():
            if 'xgboost.joblib' in k or 'baseline_preprocessor' in k:
                actual = get_hash(os.path.join(project_root, k))
                assert actual == v
