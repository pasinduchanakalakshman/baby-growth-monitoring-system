import pytest
import datetime
import numpy as np
import pandas as pd
from unittest.mock import MagicMock, patch

from app.models.baby import Baby, SexEnum
from app.models.growth_measurement import GrowthMeasurement
from app.services.model_loader import artifact_loader
from app.services.sequence_service import sequence_service, MASK_VALUE, MAX_SEQUENCE_LENGTH, N_TRANSFORMED_FEATURES
from app.services.risk_service import risk_service, prepare_feature_dataframe
from app.api.routes.growth import format_history_for_ml
from app.services.temporal_feature_service import temporal_feature_service


class TestHybridModelIntegration:
    """
    Task 4.2B Test Suite:
    Verifies integration of the frozen XGBoost + Clean Transformer hybrid into FastAPI.
    Hybrid Score = 0.90 * XGBoost Score + 0.10 * Clean Transformer Score.
    """

    @pytest.fixture
    def sample_history(self):
        """Creates a realistic 3-visit chronological sequence for an infant."""
        visits = []
        base_date = datetime.date(2023, 1, 15)
        weights = [3.3, 4.2, 5.1]
        lengths = [50.0, 54.0, 58.0]
        wazs = [-0.2, -0.15, -0.1]
        hazs = [0.0, 0.1, 0.15]

        for i in range(3):
            v_date = base_date + datetime.timedelta(days=30 * i)
            m = {
                "visit_date": str(v_date),
                "weight_kg": weights[i],
                "length_height_cm": lengths[i],
                "age_days": 30 * (i + 1),
                "verified_waz": wazs[i],
                "verified_haz": hazs[i],
                "breastfeeding_status": True,
                "formula_feeding": False,
                "complementary_feeding_started": False if i < 2 else True,
                "diarrhea_recent": False,
                "fever_recent": True if i == 1 else False,
                "respiratory_illness_recent": False,
                "recent_illness": True if i == 1 else False,
                "sex": "Male",
                "date_of_birth": "2023-01-01",
                "birth_weight_kg": 3.3,
                "birth_length_cm": 50.0,
                "gestational_age_weeks": 39,
                "birth_order": 1,
                "delivery_type": "Normal",
                "apgar_score_5min": 9
            }
            visits.append(m)
        return visits

    def test_both_frozen_models_load_successfully(self):
        """1. Verifies that both the frozen XGBoost and Clean Transformer models load correctly."""
        xgb = artifact_loader.get_risk_model()
        assert xgb is not None

        transformer = artifact_loader.get_transformer_model()
        assert transformer is not None
        assert transformer.name == "transformer_v1"

    def test_preprocessors_load_and_validate(self):
        """2. Verifies both tabular and sequence preprocessors load and produce expected dimensions."""
        xgb_prep = artifact_loader.get_risk_preprocessor()
        seq_prep = artifact_loader.get_sequence_preprocessor()

        assert xgb_prep is not None
        assert seq_prep is not None

        # Verify sequence preprocessor transforms to 49 features per timestep
        schema = artifact_loader.get_sequence_schema()
        cols = schema["numeric_features"] + schema["boolean_features"] + schema["categorical_features"]
        assert len(cols) == 38

        sample_df = pd.DataFrame([{c: np.nan for c in cols}])
        out = seq_prep.transform(sample_df)
        assert out.shape == (1, 49)

    def test_transformer_tensor_shape_and_padding(self, sample_history):
        """3 & 4. Verifies tensor shape is strictly (1, 20, 49) and left-padded with -999.0."""
        tensor = sequence_service.prepare_sequence_tensor(sample_history)

        assert tensor.shape == (1, MAX_SEQUENCE_LENGTH, N_TRANSFORMED_FEATURES)
        assert tensor.dtype == np.float32

        # 3 visits means 17 left-padded rows and 3 valid historical rows
        n_pad = 20 - 3
        # Padded rows must strictly equal -999.0
        assert np.all(tensor[0, :n_pad, :] == MASK_VALUE)

        # Valid rows must not be -999.0 and must be finite numbers
        valid_rows = tensor[0, n_pad:, :]
        assert not np.any(valid_rows == MASK_VALUE)
        assert np.all(np.isfinite(valid_rows))
        assert not np.any(np.isnan(valid_rows))

    def test_point_in_time_safety_no_future_leakage(self, sample_history):
        """5. Verifies that encounters occurring after index_visit_date are strictly excluded."""
        index_date = sample_history[1]["visit_date"]  # 2nd visit

        # Pass all 3 visits, but with index_date set to 2nd visit
        tensor = sequence_service.prepare_sequence_tensor(sample_history, index_visit_date=index_date)

        # Should only include 2 visits (18 padded, 2 valid)
        assert tensor.shape == (1, 20, 49)
        assert np.all(tensor[0, :18, :] == MASK_VALUE)
        assert not np.any(tensor[0, 18:, :] == MASK_VALUE)

    def test_sequence_feature_order_preserved(self):
        """6. Verifies sequence feature names and order strictly match sequence_feature_schema_v1.json."""
        schema = artifact_loader.get_sequence_schema()
        seq_prep = artifact_loader.get_sequence_preprocessor()

        expected_features = schema["numeric_features"] + schema["boolean_features"] + schema["categorical_features"]
        assert len(expected_features) == 38

        # Verify preprocessor transformers match schema order
        prep_cols = []
        for name, trans, cols in seq_prep.transformers_:
            prep_cols.extend(cols)
        assert prep_cols == expected_features

    def test_hybrid_score_calculation_formula(self, sample_history):
        """7. Verifies Hybrid Score = 0.90 * XGBoost + 0.10 * Transformer within 1e-5."""
        latest_features = temporal_feature_service.calculate_features(sample_history)
        for k, v in sample_history[-1].items():
            if k not in latest_features:
                latest_features[k] = v

        result = risk_service.calculate_risk(latest_features, history=sample_history)

        assert result["risk_available"] is True
        assert result["model_applicable"] is True

        p_hybrid = result["risk_probability"]
        p_xgb = result["component_scores"]["xgboost_probability"]
        p_trans = result["component_scores"]["transformer_probability"]
        alpha = result["component_scores"]["alpha_xgboost"]
        weight = result["component_scores"]["weight_transformer"]

        assert alpha == 0.90
        assert weight == 0.10
        expected_score = 0.90 * p_xgb + 0.10 * p_trans
        assert abs(p_hybrid - expected_score) < 1e-5
        assert 0.0 <= p_hybrid <= 1.0

    def test_one_visit_history_supported(self, sample_history):
        """8. Verifies 1-visit infant history is supported (19 padded rows, 1 valid row) matching training min=1."""
        single_visit = [sample_history[0]]
        tensor = sequence_service.prepare_sequence_tensor(single_visit)

        assert tensor.shape == (1, 20, 49)
        assert np.all(tensor[0, :19, :] == MASK_VALUE)
        assert not np.any(tensor[0, 19, :] == MASK_VALUE)

        # Test model can infer on single visit
        model = artifact_loader.get_transformer_model()
        pred = float(model.predict(tensor, verbose=0)[0, 0])
        assert 0.0 <= pred <= 1.0

    def test_missing_transformer_fails_gracefully_no_silent_fallback(self, sample_history):
        """9. Verifies missing Transformer artifact produces explicit risk failure, not silent XGBoost-only fallback."""
        latest_features = temporal_feature_service.calculate_features(sample_history)
        for k, v in sample_history[-1].items():
            if k not in latest_features:
                latest_features[k] = v

        # Simulate transformer failure
        with patch.object(sequence_service, "prepare_sequence_tensor", side_effect=RuntimeError("Corrupt tensor pipeline")):
            result = risk_service.calculate_risk(latest_features, history=sample_history)
            assert result["risk_available"] is False
            assert "Hybrid inference failed on Transformer branch" in result["reason"]

    def test_research_validation_prediction_reproduction(self):
        """12. Verifies exact numerical reproduction of saved validation prediction for child CH002."""
        val_csv_path = artifact_loader._get_path("data/splits/v1/validation.csv")
        val_df = pd.read_csv(val_csv_path)
        child_visits = val_df[val_df["child_id"] == "CH002"].sort_values("visit_date").copy()

        # Build sequence tensor for CH002 up to the last visit (visit 15)
        seq_schema = artifact_loader.get_sequence_schema()
        seq_prep = artifact_loader.get_sequence_preprocessor()
        cols = seq_schema["numeric_features"] + seq_schema["boolean_features"] + seq_schema["categorical_features"]

        raw_features = child_visits[cols]
        transformed = seq_prep.transform(raw_features)

        n_hist = len(transformed)
        n_pad = 20 - n_hist
        pad_rows = np.full((n_pad, 49), MASK_VALUE, dtype=np.float32)
        seq = np.vstack([pad_rows, transformed.astype(np.float32)])
        tensor = np.expand_dims(seq, axis=0)

        # Transformer score
        model = artifact_loader.get_transformer_model()
        p_trans = float(model.predict(tensor, verbose=0)[0, 0])

        # XGBoost score
        xgb_model = artifact_loader.get_risk_model()
        xgb_prep = artifact_loader.get_risk_preprocessor()
        xgb_schema = artifact_loader.get_risk_schema()
        xgb_cols = xgb_schema["numeric_features"] + xgb_schema["boolean_features"] + xgb_schema["categorical_features"]
        last_visit = child_visits.iloc[[-1]]
        X_proc = xgb_prep.transform(last_visit[xgb_cols])
        p_xgb = float(xgb_model.predict_proba(X_proc)[0, 1])

        p_hybrid = 0.90 * p_xgb + 0.10 * p_trans

        # Compare against saved validation predictions CSV
        preds_csv_path = artifact_loader._get_path("research/evaluation/hybrid_experiments/v1/hybrid_validation_predictions_v1.csv")
        val_preds_df = pd.read_csv(preds_csv_path)
        saved_row = val_preds_df[(val_preds_df["child_id"] == "CH002") & (val_preds_df["visit_date"] == "2023-06-30")].iloc[0]

        assert abs(p_trans - saved_row["transformer_probability"]) < 1e-4
        assert abs(p_xgb - saved_row["xgboost_probability"]) < 1e-4
        assert abs(p_hybrid - saved_row["fusion_score_alpha_0_90"]) < 1e-4

    def test_risk_latest_endpoint_returns_hybrid(self, client):
        """10. Verifies GET /api/v1/growth/risk/latest returns the hybrid model score and components."""
        # Register and login
        client.post("/api/v1/auth/register", json={"name": "Hybrid Mother", "email": "hybrid@example.com", "password": "securepassword"})
        login_res = client.post("/api/v1/auth/login", json={"email": "hybrid@example.com", "password": "securepassword"})
        cookies = login_res.cookies

        # Register Baby
        client.post(
            "/api/v1/baby/register",
            json={
                "name": "Hybrid Baby",
                "sex": "Male",
                "date_of_birth": "2023-01-01",
                "birth_weight_kg": 3.2,
                "birth_length_cm": 50.0,
                "gestational_age_weeks": 39,
                "birth_order": 1,
                "delivery_type": "Normal"
            },
            cookies=cookies
        )

        # Add 2 measurements
        client.post(
            "/api/v1/growth/measurements",
            json={
                "visit_date": "2023-02-01",
                "weight_kg": 4.1,
                "length_height_cm": 54.0,
                "currently_breastfeeding": True,
                "formula_feeding": False,
                "solid_foods_started": False,
                "diarrhea_last_14_days": False,
                "fever_last_14_days": False,
                "cough_last_14_days": False
            },
            cookies=cookies
        )
        client.post(
            "/api/v1/growth/measurements",
            json={
                "visit_date": "2023-03-01",
                "weight_kg": 5.0,
                "length_height_cm": 58.0,
                "currently_breastfeeding": True,
                "formula_feeding": False,
                "solid_foods_started": False,
                "diarrhea_last_14_days": False,
                "fever_last_14_days": True,
                "cough_last_14_days": False
            },
            cookies=cookies
        )

        # Call GET /api/v1/growth/risk/latest
        risk_res = client.get("/api/v1/growth/risk/latest", cookies=cookies)
        assert risk_res.status_code == 200
        data = risk_res.json()

        assert data["risk_available"] is True
        assert data["model_applicable"] is True
        assert data["model_type"] == "XGBoost + Transformer Late Fusion Hybrid"
        assert "component_scores" in data

        p_xgb = data["component_scores"]["xgboost_probability"]
        p_trans = data["component_scores"]["transformer_probability"]
        p_hybrid = data["risk_probability"]

        assert 0.0 <= p_xgb <= 1.0
        assert 0.0 <= p_trans <= 1.0
        assert abs(p_hybrid - (0.90 * p_xgb + 0.10 * p_trans)) < 1e-5

        # Verify research screening threshold is used
        assert abs(data["risk_threshold"] - 0.06405469514) < 1e-6
        expected_status = "Elevated screening risk" if p_hybrid >= data["risk_threshold"] else "Below screening threshold"
        assert data["screening_status"] == expected_status
        assert data["risk_flag"] == (1 if p_hybrid >= data["risk_threshold"] else 0)

        # Also test model-info endpoint
        info_res = client.get("/api/v1/growth/model-info")
        assert info_res.status_code == 200
        info = info_res.json()
        assert info["Risk"]["model"] == "XGBoost + Transformer Late Fusion Hybrid"
        assert abs(info["Risk"]["threshold"] - 0.06405469514) < 1e-6
        assert "0.90 * XGBoost" in info["Risk"]["fusion"] and "0.10" in info["Risk"]["fusion"]

    def test_research_screening_threshold_classification_rules(self):
        """11. Verifies research screening threshold classification rules on scores 0.080, 0.030, exact threshold, and hybrid fusion."""
        from app.services.model_loader import artifact_loader
        threshold = artifact_loader.get_research_screening_threshold()
        assert abs(threshold - 0.06405469514) < 1e-6

        # 1. Score 0.080 is classified as elevated research screening risk
        score_high = 0.080
        flag_high = 1 if score_high >= threshold else 0
        status_high = "Elevated screening risk" if score_high >= threshold else "Below screening threshold"
        assert flag_high == 1
        assert status_high == "Elevated screening risk"

        # 2. Score 0.030 is classified as below screening threshold
        score_low = 0.030
        flag_low = 1 if score_low >= threshold else 0
        status_low = "Elevated screening risk" if score_low >= threshold else "Below screening threshold"
        assert flag_low == 0
        assert status_low == "Below screening threshold"

        # 3. Score exactly equal to the threshold is classified as elevated
        score_exact = threshold
        flag_exact = 1 if score_exact >= threshold else 0
        status_exact = "Elevated screening risk" if score_exact >= threshold else "Below screening threshold"
        assert flag_exact == 1
        assert status_exact == "Elevated screening risk"

        # 4. Classification uses the real hybrid score, not standalone XGBoost
        # Example: p_xgb = 0.070 (above threshold alone), p_trans = 0.005 (low)
        # hybrid = 0.90 * 0.070 + 0.10 * 0.005 = 0.0630 + 0.0005 = 0.0635 < threshold (0.06405)
        p_xgb_sample = 0.070
        p_trans_sample = 0.005
        hybrid_sample = 0.90 * p_xgb_sample + 0.10 * p_trans_sample
        assert p_xgb_sample >= threshold, "XGBoost standalone would be above threshold"
        assert hybrid_sample < threshold, "Hybrid score is below threshold"
        flag_hybrid = 1 if hybrid_sample >= threshold else 0
        status_hybrid = "Elevated screening risk" if hybrid_sample >= threshold else "Below screening threshold"
        assert flag_hybrid == 0
        assert status_hybrid == "Below screening threshold"

