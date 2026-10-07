import pandas as pd
import numpy as np
import os
import json
import joblib
import sys
import datetime

from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import (roc_auc_score, average_precision_score, 
                             precision_score, recall_score, f1_score, 
                             confusion_matrix, brier_score_loss)

def compute_metrics(y_true, y_prob, threshold=0.5):
    y_pred = (y_prob >= threshold).astype(int)
    
    if len(np.unique(y_true)) > 1:
        roc_auc = roc_auc_score(y_true, y_prob)
        pr_auc = average_precision_score(y_true, y_prob)
        brier = brier_score_loss(y_true, y_prob)
    else:
        roc_auc = 0.0
        pr_auc = 0.0
        brier = 0.0
        
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    if cm.shape == (2, 2):
        tn, fp, fn, tp = cm.ravel()
        spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    else:
        tn, fp, fn, tp = 0, 0, 0, 0
        spec = 0.0
        
    return {
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "precision": float(prec),
        "recall": float(rec),
        "f1": float(f1),
        "specificity": float(spec),
        "brier_score": float(brier),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}
    }

def process_baseline_models():
    print("==================================================")
    print("STARTING STAGE 7: CLASSICAL BASELINE MODELS")
    print("==================================================")
    
    schema_path = os.path.join('data', 'schemas', 'supervised_180d_feature_schema_v1.json')
    with open(schema_path, 'r') as f:
        schema = json.load(f)
        
    candidate_features = schema['candidate_input_features']
    target_col = schema['target_columns'][0]
    
    # Load data
    train_path = os.path.join('data', 'splits', 'v1', 'train.csv')
    val_path = os.path.join('data', 'splits', 'v1', 'validation.csv')
    test_path = os.path.join('data', 'splits', 'v1', 'test.csv')
    
    df_train = pd.read_csv(train_path)
    df_val = pd.read_csv(val_path)
    df_test = pd.read_csv(test_path)
    
    # Exclude forbidden columns manually as a failsafe
    forbidden_cols = ['child_id', 'visit_date', 'future_growth_faltering_180d', 
                      'target_new_threshold_crossing_180d', 'target_waz_decline_05_180d',
                      'has_180d_followup']
    
    for c in forbidden_cols:
        if c in candidate_features:
            print(f"CRITICAL ERROR: Forbidden column {c} found in candidate features!")
            sys.exit(1)
            
    # Classify features based on TRAIN set
    numeric_features = []
    categorical_features = []
    boolean_features = []
    
    for c in candidate_features:
        if c not in df_train.columns:
            continue
            
        dtype = df_train[c].dtype
        unique_vals = df_train[c].dropna().unique()
        
        if len(unique_vals) <= 2 and all(v in [0, 1, 0.0, 1.0, True, False] for v in unique_vals):
            boolean_features.append(c)
        elif pd.api.types.is_numeric_dtype(dtype):
            numeric_features.append(c)
        else:
            categorical_features.append(c)
            
    print(f"Features: {len(numeric_features)} numeric, {len(boolean_features)} boolean, {len(categorical_features)} categorical")
    
    X_train_raw = df_train[numeric_features + boolean_features + categorical_features]
    y_train = df_train[target_col]
    X_val_raw = df_val[numeric_features + boolean_features + categorical_features]
    y_val = df_val[target_col]
    X_test_raw = df_test[numeric_features + boolean_features + categorical_features]
    y_test = df_test[target_col]
    
    # Build Preprocessor
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])
    
    boolean_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value=0)),
        ('scaler', StandardScaler()) # Scale boolean too, useful for some linear models
    ])
    
    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value='missing')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('bool', boolean_transformer, boolean_features),
            ('cat', categorical_transformer, categorical_features)
        ],
        remainder='drop'
    )
    
    print("Fitting preprocessor on TRAIN data only...")
    X_train = preprocessor.fit_transform(X_train_raw)
    X_val = preprocessor.transform(X_val_raw)
    X_test = preprocessor.transform(X_test_raw)
    
    # Save Preprocessor
    os.makedirs(os.path.join('models', 'scalers'), exist_ok=True)
    os.makedirs(os.path.join('models', 'metadata'), exist_ok=True)
    os.makedirs(os.path.join('models', 'trained', 'baselines', 'v1'), exist_ok=True)
    os.makedirs(os.path.join('research', 'evaluation'), exist_ok=True)
    
    joblib.dump(preprocessor, os.path.join('models', 'scalers', 'baseline_preprocessor_v1.joblib'))
    
    feature_meta = {
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "boolean_features": boolean_features,
        "transformed_feature_count": X_train.shape[1],
        "preprocessing_strategies": {
            "numeric": "median impute + StandardScaler",
            "boolean": "constant impute (0) + StandardScaler",
            "categorical": "constant impute ('missing') + OneHotEncoder(ignore)"
        },
        "target_name": target_col,
        "training_dataset_version": "v1"
    }
    with open(os.path.join('models', 'metadata', 'baseline_feature_metadata_v1.json'), 'w') as f:
        json.dump(feature_meta, f, indent=4)
        
    # Define models
    pos_count = y_train.sum()
    neg_count = len(y_train) - pos_count
    scale_pos = neg_count / pos_count if pos_count > 0 else 1.0
    
    models = {
        "Dummy (Prior)": DummyClassifier(strategy="prior"),
        "Logistic Regression (Standard)": LogisticRegression(random_state=42, max_iter=1000),
        "Logistic Regression (Balanced)": LogisticRegression(random_state=42, class_weight='balanced', max_iter=1000),
        "Random Forest (Standard)": RandomForestClassifier(random_state=42, n_jobs=-1),
        "Random Forest (Balanced)": RandomForestClassifier(random_state=42, class_weight='balanced', n_jobs=-1)
    }
    
    if HAS_XGB:
        models["XGBoost"] = XGBClassifier(random_state=42, eval_metric='logloss')
        models["XGBoost (Balanced)"] = XGBClassifier(random_state=42, scale_pos_weight=scale_pos, eval_metric='logloss')
        
    val_predictions_df = df_val[['child_id', 'visit_date', target_col]].copy()
    
    val_results = {}
    best_pr_auc = -1.0
    best_model_name = None
    
    registry = []
    
    print("Training and evaluating models...")
    for name, model in models.items():
        print(f" - {name}")
        model.fit(X_train, y_train)
        
        # Save model
        filename = name.lower().replace(" ", "_").replace("(", "").replace(")", "") + ".joblib"
        filepath = os.path.join('models', 'trained', 'baselines', 'v1', filename)
        joblib.dump(model, filepath)
        
        # Predict on validation
        y_val_prob = model.predict_proba(X_val)[:, 1]
        val_predictions_df[name] = y_val_prob
        
        metrics = compute_metrics(y_val, y_val_prob)
        val_results[name] = metrics
        
        if metrics["pr_auc"] > best_pr_auc:
            best_pr_auc = metrics["pr_auc"]
            best_model_name = name
            
        registry.append({
            "model_name": name,
            "model_type": str(type(model).__name__),
            "training_timestamp": datetime.datetime.utcnow().isoformat(),
            "random_seed": 42,
            "target": target_col,
            "feature_schema_version": "v1",
            "validation_metrics": metrics,
            "selected": False,
            "threshold": 0.5,
            "test_evaluated": False,
            "artifact_path": filepath
        })
        
    val_predictions_df.to_csv(os.path.join('research', 'evaluation', 'baseline_validation_predictions_v1.csv'), index=False)
    
    print(f"\nSelected best baseline: {best_model_name} (Val PR-AUC: {best_pr_auc:.4f})")
    
    # Mark best in registry
    for r in registry:
        if r["model_name"] == best_model_name:
            r["selected"] = True
            r["test_evaluated"] = True
            
    with open(os.path.join('models', 'metadata', 'baseline_model_registry_v1.json'), 'w') as f:
        json.dump(registry, f, indent=4)
        
    # Evaluate best model on TEST
    best_model = models[best_model_name]
    y_test_prob = best_model.predict_proba(X_test)[:, 1]
    test_metrics = compute_metrics(y_test, y_test_prob)
    
    # Error analysis for best model on TEST
    error_df = df_test[['child_id', 'visit_date', target_col]].copy()
    error_df['predicted_probability'] = y_test_prob
    error_df['predicted_class'] = (y_test_prob >= 0.5).astype(int)
    error_df['is_error'] = error_df[target_col] != error_df['predicted_class']
    error_df = error_df[error_df['is_error']].copy()
    error_df.to_csv(os.path.join('research', 'evaluation', 'baseline_error_analysis_v1.csv'), index=False)
    
    # Generate final report
    def get_dataset_stats(df_set):
        pos = df_set[target_col].sum()
        total = len(df_set)
        return {
            "rows": int(total),
            "children": int(df_set['child_id'].nunique()),
            "positives": int(pos),
            "prevalence": float(pos / total * 100) if total > 0 else 0.0
        }
        
    report = {
        "dataset_information": {
            "train": get_dataset_stats(df_train),
            "validation": get_dataset_stats(df_val),
            "test": get_dataset_stats(df_test)
        },
        "preprocessing": {
            "original_feature_count": len(numeric_features) + len(boolean_features) + len(categorical_features),
            "transformed_feature_count": X_train.shape[1],
            "missing_value_strategy": "Median for numeric, 0 for boolean, 'missing' category for categorical",
            "categorical_encoding": "OneHotEncoder(handle_unknown='ignore')"
        },
        "validation_results": val_results,
        "selected_baseline": {
            "model": best_model_name,
            "rationale": "Selected based on highest PR-AUC on the validation set, which is crucial for this highly imbalanced dataset. Test set was STRICTLY hidden during selection.",
            "threshold": 0.5
        },
        "held_out_test_results": test_metrics,
        "warnings": []
    }
    
    with open(os.path.join('research', 'evaluation', 'baseline_model_report_v1.json'), 'w') as f:
        json.dump(report, f, indent=4)
        
    print("Stage 7 complete. Reports saved.")

if __name__ == '__main__':
    process_baseline_models()
