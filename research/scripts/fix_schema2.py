import os

def fix_schema_bug2():
    path_xai = "research/scripts/xai_explanations.py"
    with open(path_xai, 'r') as f:
        content_xai = f.read()
        
    old_def = """def explain_dynamic_risk(demo_children, train_df, val_df, test_df, explainer, preprocessor, feature_names, expected_features, out_dir):"""
    new_def = """def explain_dynamic_risk(demo_children, train_df, val_df, test_df, explainer, preprocessor, schema, feature_names, expected_features, out_dir):"""
    content_xai = content_xai.replace(old_def, new_def)
    
    old_call = """            explanation = explain_risk_prediction(
                explainer, preprocessor, feature_names, expected_features, 
                obs_clean, child_id, assessment_date, top_k=3
            )"""
    new_call = """            explanation = explain_risk_prediction(
                explainer, preprocessor, schema, feature_names, expected_features, 
                obs_clean, child_id, assessment_date, top_k=3
            )"""
    content_xai = content_xai.replace(old_call, new_call)

    old_main_call = """    df_dyn = explain_dynamic_risk(demo_children, train_df, val_df, test_df, explainer, preprocessor, feature_names, expected_features, out_dir)"""
    new_main_call = """    df_dyn = explain_dynamic_risk(demo_children, train_df, val_df, test_df, explainer, preprocessor, schema, feature_names, expected_features, out_dir)"""
    content_xai = content_xai.replace(old_main_call, new_main_call)
    
    with open(path_xai, 'w') as f:
        f.write(content_xai)

if __name__ == "__main__":
    fix_schema_bug2()
    print("Fixed schema bug 2.")
