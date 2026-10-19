"""Task 4.9A: synthetic assessments and isolated tests/conftest.py database only."""
import datetime
from unittest.mock import patch

import numpy as np
import pytest
from sqlalchemy import event

from app.api.routes import growth
from app.core.database import get_db
from app.main import app
from app.services.model_loader import artifact_loader
from app.services.risk_service import risk_service
from app.services.sequence_service import sequence_service, MASK_VALUE
from app.services.xai_service import xai_service


def seed_assessment(client, count=1, email="explanation@example.com"):
    assert client.post('/api/v1/auth/register', json={
        'name': 'Synthetic Mother', 'email': email, 'password': 'securepassword'
    }).status_code == 201
    assert client.post('/api/v1/auth/login', json={
        'email': email, 'password': 'securepassword'
    }).status_code == 200
    assert client.post('/api/v1/baby/register', json={
        'name': 'Synthetic Baby', 'sex': 'Male', 'date_of_birth': '2023-01-01',
        'birth_weight_kg': 3.3, 'birth_length_cm': 50.0,
        'gestational_age_weeks': 39, 'birth_order': 1, 'delivery_type': 'Normal'
    }).status_code == 201
    for i, weight in enumerate([3.3, 4.2, 5.1][:count]):
        # Optional feeding/illness answers deliberately omitted.
        assert client.post('/api/v1/growth/measurements', json={
            'visit_date': str(datetime.date(2023, 1, 1) + datetime.timedelta(days=30*i)),
            'weight_kg': weight, 'length_height_cm': 50.0 + 4*i
        }).status_code == 201


@pytest.mark.parametrize('count', [1, 2, 3])
def test_actual_scores_same_snapshot_single_inference_and_no_writes(client, count):
    seed_assessment(client, count)
    statements = []
    db = next(app.dependency_overrides[get_db]())
    engine = db.get_bind()
    db.close()

    def record_sql(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement.strip().split()[0].upper())

    event.listen(engine, 'before_cursor_execute', record_sql)
    try:
        with patch.object(risk_service, 'calculate_risk', wraps=risk_service.calculate_risk) as inference, \
             patch.object(xai_service, 'explain_prediction', wraps=xai_service.explain_prediction) as shap, \
             patch.object(sequence_service, 'prepare_sequence_tensor', wraps=sequence_service.prepare_sequence_tensor) as sequence:
            response = client.get('/api/v1/growth/risk/explanation')
            assert response.status_code == 200, response.text
            result = response.json()
            inference.assert_called_once()
            shap.assert_called_once()
            sequence.assert_called_once()
            features = inference.call_args.args[0]
            assert shap.call_args.args[0] is features
            history = inference.call_args.kwargs['history']
            assert len(history) == count
            assert features['visit_date'] == history[-1]['visit_date']
            assert all(v['recent_illness'] is None for v in history)
        latest = client.get('/api/v1/growth/risk/latest').json()
    finally:
        event.remove(engine, 'before_cursor_execute', record_sql)
    assert not {'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'} & set(statements)
    combo = result['model_combination']
    assert combo == latest['model_combination']
    assert combo['xgboost_score'] == latest['component_scores']['xgboost_probability']
    assert combo['transformer_score'] == latest['component_scores']['transformer_probability']
    assert combo['xgboost_weight'] == 0.9
    assert combo['transformer_weight'] == 0.1
    assert combo['hybrid_score'] == latest['risk_score'] == latest['risk_probability']
    assert combo['xgboost_weighted_contribution'] == 0.9 * combo['xgboost_score']
    assert combo['transformer_weighted_contribution'] == 0.1 * combo['transformer_score']
    assert sum([combo['xgboost_weighted_contribution'], combo['transformer_weighted_contribution']]) == pytest.approx(combo['hybrid_score'], abs=1e-15)
    assert latest['risk_threshold'] == 0.06405469514
    assert latest['risk_flag'] == int(combo['hybrid_score'] >= latest['risk_threshold'])
    assert latest['screening_status'] == ('Elevated screening risk' if latest['risk_flag'] else 'Below screening threshold')
    assert result['assessment'] == {'visit_date': history[-1]['visit_date'], 'recorded_visit_count': count}
    assert result['explanation_scope'] == {
        'shap_branch': 'xgboost_only', 'shap_value_space': 'log_odds',
        'transformer_feature_attribution_available': False
    }
    # Backward-compatible SHAP output and log-odds remain untouched.
    assert result['technical_explanation']
    assert result['frontend_safe_explanation']
    assert result['model_coverage_disclosure']
    technical = result['technical_explanation']
    margin = technical['base_value'] + sum(c['shap_contribution'] for c in technical['contributions'])
    # Tree SHAP reconstructs the tabular branch through the logistic link, not hybrid score.
    assert 1 / (1 + np.exp(-margin)) == pytest.approx(combo['xgboost_score'], abs=1e-6)
    tensor = sequence_service.prepare_sequence_tensor(history)
    assert np.all(tensor[0, :20-count] == MASK_VALUE)
    assert np.isfinite(tensor[0, 20-count:]).all()
    assert not np.any(tensor[0, 20-count:] == MASK_VALUE)


def test_legacy_inference_without_breakdown_remains_compatible(client):
    seed_assessment(client)
    calculate = risk_service.calculate_risk

    def legacy_result(*args, **kwargs):
        result = calculate(*args, **kwargs)
        result.pop('model_combination', None)
        return result

    with patch.object(risk_service, 'calculate_risk', side_effect=legacy_result):
        response = client.get('/api/v1/growth/risk/explanation')
    assert response.status_code == 200
    assert response.json()['model_combination'] is None
    assert response.json()['frontend_safe_explanation']


@pytest.mark.parametrize('xgb_score, transformer_score', [(0.08, 0.2), (0.07, 0.005), (0.0, 0.0), (1.0, 1.0)])
def test_actual_branch_outputs_not_shap_used_once(xgb_score, transformer_score):
    xgb = artifact_loader.get_risk_model()
    transformer = artifact_loader.get_transformer_model()
    with patch.object(xgb, 'predict_proba', return_value=np.array([[1-xgb_score, xgb_score]])) as xgb_call, \
         patch.object(transformer, 'predict', return_value=np.array([[transformer_score]])) as trans_call, \
         patch.object(sequence_service, 'prepare_sequence_tensor', return_value=np.zeros((1, 20, 49))):
        result = risk_service.calculate_risk({'verified_waz': 0.0})
    xgb_call.assert_called_once()
    trans_call.assert_called_once()
    combo = result['model_combination']
    assert combo['xgboost_score'] == xgb_score
    assert combo['transformer_score'] == transformer_score
    assert result['risk_score'] == 0.9 * xgb_score + 0.1 * transformer_score
    assert 'shap_contribution' not in combo


@pytest.mark.parametrize('failure', ['exception', 'nan', 'outside_cohort'])
def test_unavailable_models_never_invent_breakdown(client, failure):
    seed_assessment(client)
    transformer = artifact_loader.get_transformer_model()
    if failure == 'outside_cohort':
        target = patch.object(growth.temporal_feature_service, 'calculate_features', return_value={'verified_waz': -2.1})
    elif failure == 'exception':
        target = patch.object(transformer, 'predict', side_effect=RuntimeError('unavailable'))
    else:
        target = patch.object(transformer, 'predict', return_value=np.array([[np.nan]]))
    with target, patch.object(xai_service, 'explain_prediction') as shap:
        assert client.get('/api/v1/growth/risk/explanation').status_code == 400
        result = client.get('/api/v1/growth/risk/latest').json()
        assert result['risk_available'] is False
        assert 'model_combination' not in result
        shap.assert_not_called()


def test_explanation_auth_ownership_and_no_history(client):
    assert client.get('/api/v1/growth/risk/explanation').status_code == 401
    seed_assessment(client, email='owner@example.com')
    assert client.get('/api/v1/growth/risk/explanation').status_code == 200
    assert client.post('/api/v1/auth/register', json={
        'name': 'Other Mother', 'email': 'other@example.com', 'password': 'securepassword'
    }).status_code == 201
    assert client.post('/api/v1/auth/login', json={
        'email': 'other@example.com', 'password': 'securepassword'
    }).status_code == 200
    with patch.object(risk_service, 'calculate_risk') as inference:
        assert client.get('/api/v1/growth/risk/explanation').status_code == 404
        assert client.post('/api/v1/baby/register', json={
            'name': 'Other Baby', 'sex': 'Female', 'date_of_birth': '2023-01-01',
            'birth_weight_kg': 3.0
        }).status_code == 201
        assert client.get('/api/v1/growth/risk/explanation').status_code == 400
        inference.assert_not_called()
