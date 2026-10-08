import os
import sys
import json
import hashlib
import pickle
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import GRU, Dense, Input, Masking
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.append(os.path.join(project_root, 'research', 'scripts'))

def calculate_sha256(filepath):
    sha = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for block in iter(lambda: f.read(4096), b""):
            sha.update(block)
    return sha.hexdigest()

def verify_checksums(json_path):
    if not os.path.exists(json_path):
        return False
    with open(json_path, 'r') as f:
        chk = json.load(f)
    for p, expected in chk['files'].items():
        actual = calculate_sha256(os.path.join(project_root, p))
        if actual != expected:
            print(f"Checksum failed for {p}")
            return False
    return True

# WHO Inverse Conversion
class WHOConverter:
    def __init__(self, project_root):
        boys_wfa_path = os.path.join(project_root, 'data', 'external', 'WHO Standards', 'wfa_boys_0-to-5-years_zscores.xlsx')
        girls_wfa_path = os.path.join(project_root, 'data', 'external', 'WHO Standards', 'wfa_girls_0-to-5-years_zscores.xlsx')
        
        self.boys_wfa = pd.read_excel(boys_wfa_path)
        self.girls_wfa = pd.read_excel(girls_wfa_path)
        
        # Standardize column names
        self.boys_wfa.rename(columns={'Month': 'age_days'}, inplace=True) # Usually it is Day for 0-5. Wait, the file might have Day.
        self.girls_wfa.rename(columns={'Month': 'age_days'}, inplace=True) 
        
        if 'Day' in self.boys_wfa.columns:
             self.boys_wfa['age_days'] = self.boys_wfa['Day']
             self.girls_wfa['age_days'] = self.girls_wfa['Day']

        self.boys_wfa.set_index('age_days', inplace=True)
        self.girls_wfa.set_index('age_days', inplace=True)
        
    def invert_waz_to_weight(self, sex, age_days, waz):
        try:
            if sex.lower() == 'male':
                ref = self.boys_wfa
            else:
                ref = self.girls_wfa
                
            age_months = int(round(age_days / 30.4375))
            # clip age_months to available range
            age_months = min(max(age_months, ref.index.min()), ref.index.max())
            lms = ref.loc[age_months]
            L = lms['L']
            M = lms['M']
            S = lms['S']
            
            if L != 0:
                weight = M * ((1 + L * S * waz) ** (1 / L))
            else:
                weight = M * np.exp(S * waz)
            return float(weight)
        except Exception as e:
            return np.nan

def build_sequence_dataset(df_pairs, df_temporal, feature_cols, max_len=20, mask_value=-999.0):
    # This prepares the sequence 3D array (samples, timesteps, features)
    X_seq = []
    y_waz = []
    metadata = []
    
    # We must only use visit_date <= index_visit_date
    df_temporal['visit_date'] = pd.to_datetime(df_temporal['visit_date'])
    for _, row in df_pairs.iterrows():
        cid = row['child_id']
        idx_date = pd.to_datetime(row['index_visit_date'])
        
        child_hist = df_temporal[(df_temporal['child_id'] == cid) & (df_temporal['visit_date'] <= idx_date)].sort_values('visit_date')
        
        # Take up to max_len
        hist_features = child_hist[feature_cols].values
        if len(hist_features) > max_len:
            hist_features = hist_features[-max_len:]
            
        # Left pad
        pad_len = max_len - len(hist_features)
        if pad_len > 0:
            pad = np.full((pad_len, len(feature_cols)), mask_value)
            hist_features = np.vstack([pad, hist_features])
            
        X_seq.append(hist_features)
        y_waz.append(row['target_verified_waz'])
        metadata.append(row)
        
    return np.array(X_seq), np.array(y_waz), metadata

def evaluate(actual_waz, pred_waz, df_pairs, converter, split_name):
    mae = mean_absolute_error(actual_waz, pred_waz)
    rmse = np.sqrt(mean_squared_error(actual_waz, pred_waz))
    r2 = r2_score(actual_waz, pred_waz)
    
    errors = pred_waz - actual_waz
    mean_err = np.mean(errors)
    med_err = np.median(np.abs(errors))
    
    # Derive weight
    pred_weights = []
    actual_weights = []
    
    for i, row in df_pairs.reset_index().iterrows():
        w = converter.invert_waz_to_weight(row['index_sex'], row['target_age_days'], pred_waz[i])
        pred_weights.append(w)
        actual_weights.append(row['target_weight_kg'])
        
    pred_weights = np.array(pred_weights)
    actual_weights = np.array(actual_weights)
    
    w_mae = mean_absolute_error(actual_weights, pred_weights)
    w_rmse = np.sqrt(mean_squared_error(actual_weights, pred_weights))
    w_mean_err = np.mean(pred_weights - actual_weights)
    w_med_err = np.median(np.abs(pred_weights - actual_weights))
    
    return {
        "waz_mae": float(mae),
        "waz_rmse": float(rmse),
        "waz_r2": float(r2),
        "waz_mean_error": float(mean_err),
        "waz_median_abs_error": float(med_err),
        "weight_mae": float(w_mae),
        "weight_rmse": float(w_rmse),
        "weight_mean_error": float(w_mean_err),
        "weight_median_abs_error": float(w_med_err),
        "samples": len(df_pairs),
        "children": int(df_pairs['child_id'].nunique())
    }, pred_weights

def main():
    print("Verifying Stage 12 Checksums...")
    if not verify_checksums(os.path.join(project_root, 'models', 'metadata', 'research_core_v1_checksums.json')):
        print("ERROR: Stage 12 checksums failed!")
        sys.exit(1)
        
    print("Verifying Stage 13 Checksums...")
    if not verify_checksums(os.path.join(project_root, 'models', 'metadata', 'forecast_30d_dataset_v1_checksums.json')):
        print("ERROR: Stage 13 checksums failed!")
        sys.exit(1)
        
    converter = WHOConverter(project_root)
    
    # Load Data
    train_df = pd.read_csv(os.path.join(project_root, 'data', 'forecasting', 'train_30d_forecast_v1.csv'))
    val_df = pd.read_csv(os.path.join(project_root, 'data', 'forecasting', 'validation_30d_forecast_v1.csv'))
    test_df = pd.read_csv(os.path.join(project_root, 'data', 'forecasting', 'test_30d_forecast_v1.csv'))
    temporal_df = pd.read_csv(os.path.join(project_root, 'data', 'features', 'chdr_temporal_features_v1.csv'))
    
    print(f"Data loaded: Train={len(train_df)}, Val={len(val_df)}, Test={len(test_df)}")
    
    # Features
    # Numeric features
    num_cols = [
        'forecast_horizon_days', 'index_age_days', 'index_weight_kg', 'index_verified_waz',
        'index_observation_count', 'index_days_since_previous_visit', 'index_weight_change_kg',
        'index_weight_velocity_kg_per_30d', 'index_waz_change', 'index_waz_velocity_per_30d',
        'index_waz_rolling_mean_3', 'index_weight_rolling_mean_3', 'index_birth_weight_kg'
    ]
    # Filter available num cols
    num_cols = [c for c in num_cols if c in train_df.columns]
    
    cat_cols = ['index_sex']
    cat_cols = [c for c in cat_cols if c in train_df.columns]
    
    feature_cols = num_cols + cat_cols
    
    X_train = train_df[feature_cols]
    y_train = train_df['target_verified_waz']
    
    X_val = val_df[feature_cols]
    y_val = val_df['target_verified_waz']
    
    X_test = test_df[feature_cols]
    y_test = test_df['target_verified_waz']
    
    # Preprocessor
    preprocessor = ColumnTransformer([
        ('num', Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler())
        ]), num_cols),
        ('cat', Pipeline([
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
        ]), cat_cols)
    ])
    
    X_train_proc = preprocessor.fit_transform(X_train)
    X_val_proc = preprocessor.transform(X_val)
    X_test_proc = preprocessor.transform(X_test)
    
    results = {}
    preds_val = {}
    preds_test = {}
    
    # --------------------------
    # MODEL A: Persistence
    # --------------------------
    pred_val_A = val_df['index_verified_waz'].values
    pred_test_A = test_df['index_verified_waz'].values
    results['Persistence'], pw_val_A = evaluate(y_val, pred_val_A, val_df, converter, 'validation')
    preds_val['Persistence'] = pred_val_A
    
    # --------------------------
    # MODEL B: Linear Regression
    # --------------------------
    lr = LinearRegression()
    lr.fit(X_train_proc, y_train)
    pred_val_B = lr.predict(X_val_proc)
    pred_test_B = lr.predict(X_test_proc)
    results['Linear'], pw_val_B = evaluate(y_val, pred_val_B, val_df, converter, 'validation')
    preds_val['Linear'] = pred_val_B
    
    # --------------------------
    # MODEL C: XGBoost
    # --------------------------
    xgb_reg = xgb.XGBRegressor(
        n_estimators=100, max_depth=4, learning_rate=0.05, 
        subsample=0.8, colsample_bytree=0.8, random_state=42
    )
    xgb_reg.fit(X_train_proc, y_train, eval_set=[(X_val_proc, y_val)], verbose=False)
    pred_val_C = xgb_reg.predict(X_val_proc)
    pred_test_C = xgb_reg.predict(X_test_proc)
    results['XGBoost'], pw_val_C = evaluate(y_val, pred_val_C, val_df, converter, 'validation')
    preds_val['XGBoost'] = pred_val_C
    
    # --------------------------
    # MODEL D: GRU
    # --------------------------
    # For sequence model, use base features without 'index_' prefix from temporal dataset
    seq_cols = [c.replace('index_', '') for c in num_cols if c != 'forecast_horizon_days'] + ['sex']
    seq_cols = [c for c in seq_cols if c in temporal_df.columns]
    
    seq_preprocessor = ColumnTransformer([
        ('num', Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler())
        ]), [c for c in seq_cols if c != 'sex']),
        ('cat', Pipeline([
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
        ]), ['sex'])
    ])
    
    # Fit seq preprocessor on all temporal data up to train set indices? Or just train df? 
    # To be safe, fit on train children temporal data
    train_cids = train_df['child_id'].unique()
    train_temporal = temporal_df[temporal_df['child_id'].isin(train_cids)]
    seq_preprocessor.fit(train_temporal[seq_cols])
    
    # Actually for time sake, skip GRU if it's too complex and XGBoost outperforms, but the prompt says:
    # "Develop a GRU forecasting model because..."
    # We will build a simple GRU.
    temporal_proc = temporal_df.copy()
    proc_vals = seq_preprocessor.transform(temporal_df[seq_cols])
    
    # Create transformed column names
    feat_names = [f"f{i}" for i in range(proc_vals.shape[1])]
    temp_proc_df = pd.DataFrame(proc_vals, columns=feat_names)
    temp_proc_df['child_id'] = temporal_df['child_id']
    temp_proc_df['visit_date'] = temporal_df['visit_date']
    
    X_train_seq, y_train_seq, _ = build_sequence_dataset(train_df, temp_proc_df, feat_names)
    X_val_seq, y_val_seq, _ = build_sequence_dataset(val_df, temp_proc_df, feat_names)
    X_test_seq, y_test_seq, _ = build_sequence_dataset(test_df, temp_proc_df, feat_names)
    
    gru = Sequential([
        Masking(mask_value=-999.0, input_shape=(20, len(feat_names))),
        GRU(32, return_sequences=False),
        Dense(16, activation='relu'),
        Dense(1)
    ])
    gru.compile(optimizer=Adam(learning_rate=0.005), loss='mse')
    gru.fit(X_train_seq, y_train_seq, validation_data=(X_val_seq, y_val_seq), epochs=15, batch_size=32, 
            callbacks=[EarlyStopping(patience=3)], verbose=0)
            
    pred_val_D = gru.predict(X_val_seq).flatten()
    pred_test_D = gru.predict(X_test_seq).flatten()
    results['GRU'], pw_val_D = evaluate(y_val_seq, pred_val_D, val_df, converter, 'validation')
    preds_val['GRU'] = pred_val_D
    
    # Select Best Model based on Validation WAZ MAE
    best_model_name = min(results, key=lambda k: results[k]['waz_mae'])
    print(f"Selected Model: {best_model_name}")
    
    # Evaluate Best Model on Test
    best_preds_test = None
    if best_model_name == 'Persistence':
        best_preds_test = pred_test_A
    elif best_model_name == 'Linear':
        best_preds_test = pred_test_B
    elif best_model_name == 'XGBoost':
        best_preds_test = pred_test_C
    elif best_model_name == 'GRU':
        best_preds_test = pred_test_D
        
    test_results, pw_test_best = evaluate(y_test, best_preds_test, test_df, converter, 'test')
    
    # Subgroup 28-32
    val_sub = val_df[(val_df['forecast_horizon_days'] >= 28) & (val_df['forecast_horizon_days'] <= 32)]
    if len(val_sub) > 0:
        val_sub_idx = val_sub.index
        sub_actual = y_val.loc[val_sub_idx]
        sub_pred = preds_val[best_model_name][val_sub_idx]
        sub_res, _ = evaluate(sub_actual, sub_pred, val_sub, converter, 'val_sub')
    else:
        sub_res = None
        
    test_sub = test_df[(test_df['forecast_horizon_days'] >= 28) & (test_df['forecast_horizon_days'] <= 32)]
    if len(test_sub) > 0:
        test_sub_idx = test_sub.index
        sub_test_actual = y_test.loc[test_sub_idx]
        sub_test_pred = best_preds_test[test_sub_idx]
        sub_test_res, _ = evaluate(sub_test_actual, sub_test_pred, test_sub, converter, 'test_sub')
    else:
        sub_test_res = None
        
    # Save Outputs
    out_dir = os.path.join(project_root, 'models', 'forecasting', 'v1')
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(os.path.join(project_root, 'models', 'metadata'), exist_ok=True)
    
    # Save schemas and metadata
    schema = {
        "model_inputs": feature_cols,
        "sequence_features": seq_cols if best_model_name == 'GRU' else None,
        "padding": "left",
        "mask_value": -999.0,
        "nominal_horizon": 30,
        "forecast_horizon_days_included": True,
        "forbidden_leakage_fields": [
            "target_verified_waz", "target_weight_kg", "target_verified_haz", 
            "weight_change_kg_30d_observed", "future_growth_faltering_180d"
        ]
    }
    schema_path = os.path.join(project_root, 'data', 'schemas', 'forecast_30d_model_feature_schema_v1.json')
    with open(schema_path, 'w') as f:
        json.dump(schema, f, indent=4)
        
    # Save artifacts
    preprocessor_path = os.path.join(out_dir, 'final_preprocessor_v1.joblib')
    model_path = os.path.join(out_dir, f'final_model_v1.{"joblib" if best_model_name != "GRU" else "keras"}')
    
    if best_model_name == 'XGBoost':
        with open(preprocessor_path, 'wb') as f:
            pickle.dump(preprocessor, f)
        with open(model_path, 'wb') as f:
            pickle.dump(xgb_reg, f)
    elif best_model_name == 'Linear':
        with open(preprocessor_path, 'wb') as f:
            pickle.dump(preprocessor, f)
        with open(model_path, 'wb') as f:
            pickle.dump(lr, f)
    elif best_model_name == 'GRU':
        with open(preprocessor_path, 'wb') as f:
            pickle.dump(seq_preprocessor, f)
        gru.save(model_path)
    else: # Persistence
        pass
        
    metadata = {
        "model_name": best_model_name,
        "model_version": "v1",
        "selected_operational_window": "25-35 days",
        "nominal_forecast_horizon": 30,
        "primary_target": "target_verified_waz",
        "derived_output": "target_weight_kg",
        "training_sample_count": len(train_df),
        "validation_sample_count": len(val_df),
        "test_sample_count": len(test_df),
        "feature_schema": "data/schemas/forecast_30d_model_feature_schema_v1.json",
        "preprocessing_artifact": "models/forecasting/v1/final_preprocessor_v1.joblib" if best_model_name != 'Persistence' else None,
        "model_artifact": f"models/forecasting/v1/final_model_v1.joblib" if best_model_name not in ['Persistence', 'GRU'] else (None if best_model_name == 'Persistence' else "models/forecasting/v1/final_model_v1.keras"),
        "validation_metrics": results[best_model_name],
        "held_out_test_metrics": test_results,
        "who_conversion_method": "Inverse WHO LMS Equations",
        "research_core_version": "research-core-v1",
        "limitations": [
            "Forecast is approximately 30 days",
            "Training targets from genuine visits 25-35 days later",
            "Output is an estimate, not a guarantee",
            "Not a diagnosis",
            "Not clinically externally validated"
        ]
    }
    
    meta_path = os.path.join(project_root, 'models', 'metadata', 'final_forecast_model_v1.json')
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=4)
        
    # Checksums
    chk_files = {
        "data/schemas/forecast_30d_model_feature_schema_v1.json": calculate_sha256(schema_path),
        "models/metadata/final_forecast_model_v1.json": calculate_sha256(meta_path)
    }
    if best_model_name != 'Persistence':
        chk_files["models/forecasting/v1/final_preprocessor_v1.joblib"] = calculate_sha256(preprocessor_path)
        ext = "joblib" if best_model_name != 'GRU' else 'keras'
        chk_files[f"models/forecasting/v1/final_model_v1.{ext}"] = calculate_sha256(model_path)
        
    chk = {
        "version": "forecast_model_v1",
        "algorithm": "SHA256",
        "files": chk_files
    }
    
    chk_path = os.path.join(project_root, 'models', 'metadata', 'forecast_model_v1_checksums.json')
    with open(chk_path, 'w') as f:
        json.dump(chk, f, indent=4)
        
    # Save Predictions
    eval_dir = os.path.join(project_root, 'research', 'forecasting', 'evaluation')
    os.makedirs(eval_dir, exist_ok=True)
    
    def save_preds(df_true, pred_waz, pred_weight, name):
        out = pd.DataFrame({
            'child_id': df_true['child_id'],
            'index_visit_date': df_true['index_visit_date'],
            'target_visit_date': df_true['target_visit_date'],
            'forecast_horizon_days': df_true['forecast_horizon_days'],
            'index_weight_kg': df_true['index_weight_kg'],
            'index_verified_waz': df_true['index_verified_waz'],
            'actual_future_waz': df_true['target_verified_waz'],
            'predicted_future_waz': pred_waz,
            'actual_future_weight_kg': df_true['target_weight_kg'],
            'predicted_future_weight_kg': pred_weight,
            'actual_weight_change_kg': df_true['weight_change_kg_30d_observed'],
            'predicted_weight_change_kg': pred_weight - df_true['index_weight_kg'],
            'waz_error': pred_waz - df_true['target_verified_waz'],
            'weight_error_kg': pred_weight - df_true['target_weight_kg']
        })
        out.to_csv(os.path.join(eval_dir, name), index=False)
        
    save_preds(val_df, preds_val[best_model_name], pw_val_A if best_model_name == 'Persistence' else (pw_val_B if best_model_name == 'Linear' else (pw_val_C if best_model_name == 'XGBoost' else pw_val_D)), 'stage14_validation_predictions_v1.csv')
    save_preds(test_df, best_preds_test, pw_test_best, 'stage14_test_predictions_v1.csv')
    
    # Save report data
    report_data = {
        "val_results": results,
        "test_results": test_results,
        "best_model": best_model_name,
        "sub_val": sub_res,
        "sub_test": sub_test_res
    }
    with open(os.path.join(eval_dir, 'stage14_data.json'), 'w') as f:
        json.dump(report_data, f, indent=4)
        
    print("Stage 14 completion successful.")

if __name__ == '__main__':
    main()
