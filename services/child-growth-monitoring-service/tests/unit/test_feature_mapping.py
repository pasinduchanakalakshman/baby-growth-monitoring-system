import pytest
import datetime
import numpy as np
import pandas as pd
from unittest.mock import MagicMock

from app.models.baby import Baby, SexEnum
from app.models.growth_measurement import GrowthMeasurement
from app.api.routes.growth import format_history_for_ml, normalize_delivery_type, derive_recent_illness
from app.services.risk_service import prepare_feature_dataframe, risk_service
from app.services.temporal_feature_service import temporal_feature_service
from app.services.model_loader import artifact_loader


class TestFeatureNameAndValueMapping:
    """
    Task 4.2A Unit Test Suite:
    Verifies backend AI feature mapping from Child profile and GrowthMeasurement
    to the frozen AI preprocessing pipeline and baseline XGBoost model.
    """

    @pytest.fixture
    def sample_baby(self):
        baby = MagicMock(spec=Baby)
        baby.id = 1
        baby.name = "Test Baby"
        baby.sex = SexEnum.male
        baby.date_of_birth = datetime.date(2023, 1, 15)
        baby.birth_weight_kg = 3.25
        baby.birth_length_cm = 49.5
        baby.gestational_age_weeks = 38
        baby.birth_order = 1
        baby.delivery_type = "Vaginal"
        baby.apgar_score_5min = 9
        return baby

    @pytest.fixture
    def sample_measurement(self):
        m = MagicMock(spec=GrowthMeasurement)
        m.id = 101
        m.baby_id = 1
        m.visit_date = datetime.date(2023, 4, 15)
        m.weight_kg = 6.20
        m.length_height_cm = 61.5
        m.currently_breastfeeding = True
        m.formula_feeding = False
        m.solid_foods_started = False
        m.diarrhea_last_14_days = False
        m.fever_last_14_days = True
        m.cough_last_14_days = False
        m.age_days = 90
        m.verified_waz = -0.35
        m.verified_haz = 0.12
        return m

    def test_delivery_type_normalization(self):
        """Verifies delivery type strings are normalized to preprocessor categories ('Normal' / 'C-Section')."""
        assert normalize_delivery_type("Normal") == "Normal"
        assert normalize_delivery_type("vaginal") == "Normal"
        assert normalize_delivery_type("Vaginal") == "Normal"
        assert normalize_delivery_type("spontaneous") == "Normal"
        assert normalize_delivery_type("SVD") == "Normal"
        assert normalize_delivery_type("C-Section") == "C-Section"
        assert normalize_delivery_type("c-section") == "C-Section"
        assert normalize_delivery_type("Caesarean") == "C-Section"
        assert normalize_delivery_type("cesarean") == "C-Section"
        assert normalize_delivery_type(None) is None
        assert normalize_delivery_type("") is None

    def test_derive_recent_illness(self):
        """Verifies composite recent_illness flag accurately derives and preserves missingness."""
        # Any True -> True
        assert derive_recent_illness(True, False, False) is True
        assert derive_recent_illness(False, True, False) is True
        assert derive_recent_illness(False, False, True) is True
        assert derive_recent_illness(True, None, None) is True
        # All False -> False
        assert derive_recent_illness(False, False, False) is False
        # All None -> None (preserved unknown)
        assert derive_recent_illness(None, None, None) is None
        # False + None -> None (cannot confirm absence of unrecorded illnesses)
        assert derive_recent_illness(False, None, False) is None

    def test_format_history_feeding_mapping(self, sample_baby, sample_measurement):
        """Verifies currently_breastfeeding and solid_foods_started map to expected feature schema names."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [sample_measurement]

        history = format_history_for_ml(sample_baby, mock_db)
        assert len(history) == 1
        record = history[0]

        # Target expected schema names
        assert record["breastfeeding_status"] is True
        assert record["formula_feeding"] is False
        assert record["complementary_feeding_started"] is False

        # Legacy names maintained for backward compatibility
        assert record["currently_breastfeeding"] is True
        assert record["solid_foods_started"] is False

    def test_format_history_illness_mapping(self, sample_baby, sample_measurement):
        """Verifies diarrhea, fever, and cough map to exact expected schema names and composite flag."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [sample_measurement]

        history = format_history_for_ml(sample_baby, mock_db)
        record = history[0]

        # Target expected schema names
        assert record["diarrhea_recent"] is False
        assert record["fever_recent"] is True
        assert record["respiratory_illness_recent"] is False
        assert record["recent_illness"] is True  # Because fever is True

        # Legacy names maintained
        assert record["diarrhea_last_14_days"] is False
        assert record["fever_last_14_days"] is True
        assert record["cough_last_14_days"] is False

    def test_format_history_birth_demographics(self, sample_baby, sample_measurement):
        """Verifies child-level birth and demographic variables are included under exact schema names."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [sample_measurement]

        history = format_history_for_ml(sample_baby, mock_db)
        record = history[0]

        assert record["sex"] == "Male"
        assert record["date_of_birth"] == "2023-01-15"
        assert record["birth_weight_kg"] == 3.25
        assert record["birth_length_cm"] == 49.5
        assert record["gestational_age_weeks"] == 38
        assert record["birth_order"] == 1
        assert record["delivery_type"] == "Normal"  # "Vaginal" normalized to "Normal"
        assert record["apgar_score_5min"] == 9

    def test_preserve_missing_values(self, sample_baby):
        """Preserves missing values accurately; does not convert unrecorded answers to False or 0."""
        unrecorded_meas = MagicMock(spec=GrowthMeasurement)
        unrecorded_meas.id = 102
        unrecorded_meas.baby_id = 1
        unrecorded_meas.visit_date = datetime.date(2023, 2, 15)
        unrecorded_meas.weight_kg = 4.10
        unrecorded_meas.length_height_cm = None
        unrecorded_meas.currently_breastfeeding = None
        unrecorded_meas.formula_feeding = None
        unrecorded_meas.solid_foods_started = None
        unrecorded_meas.diarrhea_last_14_days = None
        unrecorded_meas.fever_last_14_days = None
        unrecorded_meas.cough_last_14_days = None
        unrecorded_meas.age_days = 31
        unrecorded_meas.verified_waz = -0.1
        unrecorded_meas.verified_haz = None

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [unrecorded_meas]

        history = format_history_for_ml(sample_baby, mock_db)
        record = history[0]

        # Missing values must remain None (not coerced to False or 0)
        assert record["breastfeeding_status"] is None
        assert record["formula_feeding"] is None
        assert record["complementary_feeding_started"] is None
        assert record["diarrhea_recent"] is None
        assert record["fever_recent"] is None
        assert record["respiratory_illness_recent"] is None
        assert record["recent_illness"] is None
        assert record["length_height_cm"] is None
        assert record["verified_haz"] is None

    def test_prepare_feature_dataframe_conforms_to_schema(self):
        """Verifies predictor DataFrame matches the frozen preprocessor input schema exactly (shape 1x346, 0 NaNs)."""
        schema = artifact_loader.get_risk_schema()
        preprocessor = artifact_loader.get_risk_preprocessor()

        # Features with partial missingness as would arrive from real clinical visit
        features = {
            "sex": "Female",
            "date_of_birth": "2023-05-10",
            "birth_weight_kg": 3.1,
            "birth_length_cm": None,
            "gestational_age_weeks": 40,
            "birth_order": None,
            "delivery_type": "C-Section",
            "apgar_score_5min": None,
            "age_days": 180,
            "weight_kg": 7.4,
            "length_height_cm": 65.0,
            "verified_waz": -0.4,
            "verified_haz": -0.2,
            "breastfeeding_status": True,
            "formula_feeding": False,
            "complementary_feeding_started": True,
            "recent_illness": False,
            "diarrhea_recent": False,
            "fever_recent": False,
            "respiratory_illness_recent": False,
            "observation_count": 5,
            "days_since_previous_visit": 30,
            "weight_change_kg": 0.5,
            "waz_change": -0.05,
            "weight_velocity_kg_per_day": 0.5 / 30,
            "weight_velocity_kg_per_30d": 0.5,
            "waz_velocity_per_day": -0.05 / 30,
            "waz_velocity_per_30d": -0.05,
            "height_measurement_available": 1,
            "last_observed_height_cm": 65.0,
            "last_observed_haz": -0.2,
            "days_since_last_height_measurement": 30,
            "height_change_cm": 1.5,
            "haz_change": 0.0,
            "height_velocity_cm_per_day": 1.5 / 30,
            "height_velocity_cm_per_30d": 1.5,
            "haz_velocity_per_day": 0.0,
            "haz_velocity_per_30d": 0.0,
            "waz_rolling_mean_3": -0.38,
            "weight_rolling_mean_3": 7.1
        }

        df = prepare_feature_dataframe(features, schema)

        # 1. Check all schema columns exist in df
        expected_columns = (
            schema["numeric_features"] +
            schema["boolean_features"] +
            schema["categorical_features"]
        )
        assert len(expected_columns) == 48
        for col in expected_columns:
            assert col in df.columns

        # 2. Transform through frozen pipeline
        X_proc = preprocessor.transform(df)
        assert X_proc.shape == (1, 346)
        assert np.isnan(X_proc).sum() == 0, "Transformed features must not contain any NaNs"

    def test_no_target_labels_or_future_leakage(self):
        """Verifies that future visits or target labels NEVER enter predictor DataFrame."""
        schema = artifact_loader.get_risk_schema()

        leakage_features = {
            "verified_waz": -0.5,
            "future_growth_faltering_180d": 1,
            "target_new_threshold_crossing_180d": 1,
            "target_waz_decline_05_180d": 1,
            "future_visit_date": "2024-01-01",
            "weight_kg": 6.5
        }

        df = prepare_feature_dataframe(leakage_features, schema)

        assert "future_growth_faltering_180d" not in df.columns
        assert "target_new_threshold_crossing_180d" not in df.columns
        assert "target_waz_decline_05_180d" not in df.columns
        assert "future_visit_date" not in df.columns

    def test_end_to_end_risk_calculation_with_mapped_features(self, sample_baby, sample_measurement):
        """Verifies end-to-end flow from format_history_for_ml -> temporal -> risk_service."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [sample_measurement]

        history = format_history_for_ml(sample_baby, mock_db)
        assert len(history) == 1

        temporal_feats = temporal_feature_service.calculate_features(history)
        for k, v in history[-1].items():
            if k not in temporal_feats:
                temporal_feats[k] = v

        # Calculate risk
        risk_result = risk_service.calculate_risk(temporal_feats)
        assert risk_result["risk_available"] is True
        assert risk_result["model_applicable"] is True
        assert 0.0 <= risk_result["risk_probability"] <= 1.0
        assert risk_result["risk_flag"] in [0, 1]
        assert risk_result["prediction_horizon_days"] == 180
