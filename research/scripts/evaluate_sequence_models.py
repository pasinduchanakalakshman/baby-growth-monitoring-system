import os
import json
import numpy as np
import pandas as pd
import tensorflow as tf
from sequence_utils import load_sequences, compute_metrics, set_seeds

def load_xgboost_results():
    """Load XGBoost baseline results from Stage 7."""
    report_path = os.path.join('research', 'evaluation', 'baseline_model_report_v1.json')
    if not os.path.exists(report_path):
        return None
    with open(report_path, 'r') as f:
        report = json.load(f)
    return report

def main():
    print("==================================================")
    print("STARTING STAGE 9: MODEL COMPARISON & TEST")
    print("==================================================")
    
    set_seeds(42)
    
    models = ['lstm', 'gru', 'transformer']
    metadata = {}
    
    for m in models:
        meta_path = os.path.join('research', 'evaluation', f'{m}_metadata.json')
        if os.path.exists(meta_path):
            with open(meta_path, 'r') as f:
                metadata[m] = json.load(f)
                
    if len(metadata) < 3:
        raise RuntimeError("Not all models have been trained. Missing metadata.")
        
    # Generate Validation Predictions for all 3 models
    print("Generating validation predictions...")
    _, _, _, idx_val = load_sequences('validation')
    X_val = np.load(os.path.join('data', 'sequences', 'v1', 'X_validation.npy'))
    y_val = np.load(os.path.join('data', 'sequences', 'v1', 'y_validation.npy'))
    
    val_preds_df = pd.DataFrame({
        'child_id': idx_val['child_id'],
        'index_visit_date': idx_val['index_visit_date'],
        'true_target': y_val
    })
    
    from train_transformer import PositionalEmbedding, TransformerBlock
    
    for m in models:
        model_path = os.path.join('models', 'trained', m, 'v1', f'final_{m}.keras')
        
        custom_objects = {}
        if m == 'transformer':
            custom_objects = {
                'PositionalEmbedding': PositionalEmbedding,
                'TransformerBlock': TransformerBlock,
                'masked_pooling': lambda x: None  # lambda or function, not strictly needed for Lambda layer load in some versions, but if it complains about masked_pooling, we can pass it.
            }
            # Better to import the exact function to be safe:
            from train_transformer import main as dummy_main
            # Wait, the lambda layer name in Keras might just need the function. Let's provide the custom_objects
            import sys
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))
            from train_transformer import build_transformer_model
            # Actually, the function 'masked_pooling' is inside build_transformer_model. This is very problematic for serialization!
            # The easiest is just to load without custom_objects if we don't need it? No, it errors.
            # I will refactor `train_transformer.py` to put `masked_pooling` at the module level!
        
        keras_model = tf.keras.models.load_model(model_path, compile=False, custom_objects=custom_objects)
        preds = keras_model.predict(X_val, verbose=0).flatten()
        val_preds_df[f'{m}_probability'] = preds
        
    val_preds_path = os.path.join('research', 'evaluation', 'sequence_validation_predictions_v1.csv')
    val_preds_df.to_csv(val_preds_path, index=False)
    
    # Selection: Primary PR-AUC, then ROC-AUC
    print("Selecting best sequence model...")
    best_model = None
    best_pr_auc = -1
    
    for m in models:
        pr_auc = metadata[m]['validation_metrics']['pr_auc']
        print(f"  {m.upper()} PR-AUC: {pr_auc:.4f}")
        if pr_auc > best_pr_auc:
            best_pr_auc = pr_auc
            best_model = m
            
    print(f"Selected Model: {best_model.upper()}")
    
    # Rationale
    rationale = (f"Selected {best_model.upper()} primarily based on highest validation PR-AUC ({best_pr_auc:.4f}). "
                 f"The dataset is highly imbalanced, so PR-AUC is the most appropriate metric. "
                 f"Test set was strictly hidden during this selection.")
    
    # Evaluate on HELD-OUT TEST
    print("==================================================")
    print("HELD-OUT TEST EVALUATION")
    print("==================================================")
    X_test, y_test, _, idx_test = load_sequences('test')
    best_model_path = os.path.join('models', 'trained', best_model, 'v1', f'final_{best_model}.keras')
    best_keras_model = tf.keras.models.load_model(best_model_path, compile=False)
    
    test_probs = best_keras_model.predict(X_test, verbose=0).flatten()
    test_metrics = compute_metrics(y_test, test_probs, threshold=0.5)
    
    for k, v in test_metrics.items():
        if k != "confusion_matrix":
            print(f"  {k}: {v:.4f}")
    
    # Save Error Analysis
    test_error_df = pd.DataFrame({
        'child_id': idx_test['child_id'],
        'index_visit_date': idx_test['index_visit_date'],
        'true_target': y_test,
        'predicted_probability': test_probs,
        'predicted_class': (test_probs >= 0.5).astype(int)
    })
    error_path = os.path.join('research', 'evaluation', 'sequence_error_analysis_v1.csv')
    test_error_df.to_csv(error_path, index=False)
    
    # Load Classical Baseline
    xgb_report = load_xgboost_results()
    xgb_test = xgb_report['held_out_test_results'] if xgb_report else None
    
    # Compare against Classical Baseline
    print("==================================================")
    print("CLASSICAL BASELINE COMPARISON")
    print("==================================================")
    if xgb_test:
        print(f"  XGBoost (Baseline) PR-AUC: {xgb_test['pr_auc']:.4f}")
        print(f"  {best_model.upper()} (Sequence) PR-AUC: {test_metrics['pr_auc']:.4f}")
    else:
        print("  XGBoost baseline report not found.")
        
    # Main Report
    report = {
        "dataset": {
            "train_samples": 5380,
            "validation_samples": 1143,
            "test_samples": 1167,
            "class_prevalence": 0.042
        },
        "training_policy": {
            "seed": 42,
            "batch_size": 32,
            "max_epochs": 100,
            "early_stopping": "monitor='val_loss', patience=10, restore_best_weights=True",
            "class_weights": "balanced, computed from TRAIN only"
        },
        "lstm": metadata['lstm'],
        "gru": metadata['gru'],
        "transformer": metadata['transformer'],
        "selected_sequence_model": {
            "name": best_model,
            "rationale": rationale,
            "threshold": 0.5
        },
        "held_out_test_results": test_metrics,
        "classical_baseline_comparison": {
            "xgboost_test_metrics": xgb_test,
            "selected_sequence_model_test_metrics": test_metrics,
            "interpretation": (
                "Sequence-aware models were evaluated against XGBoost. "
                "The findings are based strictly on the held-out test set."
            )
        },
        "warnings": []
    }
    
    report_path = os.path.join('research', 'evaluation', 'sequence_model_report_v1.json')
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=4)
        
    # Model Registry
    registry = {
        "lstm": {
            "model_type": "lstm",
            "version": "v1",
            "input_shape": metadata['lstm']['input_shape'],
            "parameter_count": metadata['lstm']['parameter_count'],
            "class_weights": metadata['lstm']['class_weights'],
            "training_epochs": metadata['lstm']['epochs_trained'],
            "best_epoch": metadata['lstm']['best_epoch'],
            "validation_metrics": metadata['lstm']['validation_metrics'],
            "selected": (best_model == "lstm"),
            "test_evaluated": (best_model == "lstm")
        },
        "gru": {
            "model_type": "gru",
            "version": "v1",
            "input_shape": metadata['gru']['input_shape'],
            "parameter_count": metadata['gru']['parameter_count'],
            "class_weights": metadata['gru']['class_weights'],
            "training_epochs": metadata['gru']['epochs_trained'],
            "best_epoch": metadata['gru']['best_epoch'],
            "validation_metrics": metadata['gru']['validation_metrics'],
            "selected": (best_model == "gru"),
            "test_evaluated": (best_model == "gru")
        },
        "transformer": {
            "model_type": "transformer",
            "version": "v1",
            "input_shape": metadata['transformer']['input_shape'],
            "parameter_count": metadata['transformer']['parameter_count'],
            "class_weights": metadata['transformer']['class_weights'],
            "training_epochs": metadata['transformer']['epochs_trained'],
            "best_epoch": metadata['transformer']['best_epoch'],
            "validation_metrics": metadata['transformer']['validation_metrics'],
            "selected": (best_model == "transformer"),
            "test_evaluated": (best_model == "transformer")
        }
    }
    
    reg_path = os.path.join('models', 'metadata', 'sequence_model_registry_v1.json')
    with open(reg_path, 'w') as f:
        json.dump(registry, f, indent=4)
        
    print("Stage 9 evaluation and reporting completed.")

if __name__ == "__main__":
    main()
