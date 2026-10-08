import os
import sys
import json
import pandas as pd
import numpy as np
import importlib.util

project_root = os.path.abspath('.')

loader_path = os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'model_loader.py')
spec = importlib.util.spec_from_file_location("app.services.model_loader", loader_path)
model_loader = importlib.util.module_from_spec(spec)
sys.modules["app.services.model_loader"] = model_loader
spec.loader.exec_module(model_loader)
artifact_loader = model_loader.artifact_loader

forecast_path = os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'forecast_service.py')
spec3 = importlib.util.spec_from_file_location("app.services.forecast_service", forecast_path)
forecast_service_mod = importlib.util.module_from_spec(spec3)
sys.modules["app.services.forecast_service"] = forecast_service_mod
spec3.loader.exec_module(forecast_service_mod)
forecast_service = forecast_service_mod.forecast_service

temp_df = pd.read_csv('data/features/chdr_temporal_features_v1.csv')
val_raw = pd.read_csv('data/forecasting/validation_30d_forecast_v1.csv')
preds_df = pd.read_csv('research/forecasting/evaluation/stage14_validation_predictions_v1.csv')

row = val_raw.iloc[0]
cid = row['child_id']
idx_date = row['index_visit_date']

c_history = temp_df[(temp_df['child_id'] == cid) & (temp_df['visit_date'] <= idx_date)].sort_values('visit_date')
history = c_history.replace({np.nan: None}).to_dict('records')

prod_out = forecast_service.generate_forecast(history, row['index_sex'], row['index_age_days'])
pred_res = preds_df.iloc[0]

print("Diffs:")
print(f"Prod WAZ: {prod_out['estimated_future_waz']}, Stage14: {pred_res['predicted_future_waz']}")

schema = artifact_loader.get_forecast_schema()
model_inputs = schema.get('model_inputs', [])

model_features = {}
for col in model_inputs:
    if col == 'forecast_horizon_days':
        model_features[col] = 30
    elif col == 'index_sex':
        model_features[col] = row['index_sex']
    elif col == 'index_age_days':
        model_features[col] = row['index_age_days']
    elif col == 'index_birth_weight_kg':
        model_features[col] = history[0].get('weight_kg')
    else:
        base_name = col.replace('index_', '', 1)
        latest_visit = history[-1]
        
        temporal_path = os.path.join(project_root, 'services', 'child-growth-monitoring-service', 'app', 'services', 'temporal_feature_service.py')
        spec2 = importlib.util.spec_from_file_location("app.services.temporal_feature_service", temporal_path)
        temporal_feature_service_mod = importlib.util.module_from_spec(spec2)
        sys.modules["app.services.temporal_feature_service"] = temporal_feature_service_mod
        spec2.loader.exec_module(temporal_feature_service_mod)
        temporal_feature_service = temporal_feature_service_mod.temporal_feature_service
        
        temporal_feats = temporal_feature_service.calculate_features(history)
        if base_name in latest_visit:
            model_features[col] = latest_visit[base_name]
        else:
            model_features[col] = temporal_feats.get(base_name)

print("\nModel Features Comparison:")
for col in model_inputs:
    val_val = row[col] if col in row else 'MISSING in val_raw'
    prod_val = model_features[col]
    
    if pd.isna(val_val) and prod_val is None:
        continue
    # handle float rounding display
    if type(val_val) == float and type(prod_val) == float:
        if abs(val_val - prod_val) < 1e-5:
            continue
    elif val_val == prod_val:
        continue
        
    print(f"{col}: Val_raw = {val_val} | Prod = {prod_val}")
