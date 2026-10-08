import os

def fix_schema_bug():
    # 1. Update xai_explanations.py
    path_xai = "research/scripts/xai_explanations.py"
    with open(path_xai, 'r') as f:
        content_xai = f.read()
        
    old_def = """def explain_risk_prediction(
    explainer, preprocessor, feature_names, expected_features, obs, child_id=None, assessment_date=None, top_k=3
):"""
    new_def = """def explain_risk_prediction(
    explainer, preprocessor, schema, feature_names, expected_features, obs, child_id=None, assessment_date=None, top_k=3
):"""
    content_xai = content_xai.replace(old_def, new_def)
    
    old_call = """    ex = explain_risk_prediction(explainer, preprocessor, feature_names, expected_features, obs_clean, 'CH048', obs['visit_date'])"""
    new_call = """    ex = explain_risk_prediction(explainer, preprocessor, schema, feature_names, expected_features, obs_clean, 'CH048', obs['visit_date'])"""
    content_xai = content_xai.replace(old_call, new_call)
    
    with open(path_xai, 'w') as f:
        f.write(content_xai)
        
    # 2. Update test_xai.py
    path_test = "research/tests/test_xai.py"
    with open(path_test, 'r') as f:
        content_test = f.read()
        
    old_test_call1 = """    explanation = xai.explain_risk_prediction(
        explainer, preprocessor, feature_names, expected, sample_obs, top_k=3
    )"""
    new_test_call1 = """    explanation = xai.explain_risk_prediction(
        explainer, preprocessor, schema, feature_names, expected, sample_obs, top_k=3
    )"""
    content_test = content_test.replace(old_test_call1, new_test_call1)
    
    old_test_call2 = """    exp2 = xai.explain_risk_prediction(
        explainer, preprocessor, feature_names, expected, sample_obs, top_k=3
    )"""
    new_test_call2 = """    exp2 = xai.explain_risk_prediction(
        explainer, preprocessor, schema, feature_names, expected, sample_obs, top_k=3
    )"""
    content_test = content_test.replace(old_test_call2, new_test_call2)
    
    with open(path_test, 'w') as f:
        f.write(content_test)

if __name__ == "__main__":
    fix_schema_bug()
    print("Fixed schema bug.")
