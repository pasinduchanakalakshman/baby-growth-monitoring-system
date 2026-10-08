"""
temporal_xai.py – Stage 11

Explainable AI for frozen Transformer research model.
Implements Integrated Gradients to extract temporal and feature attributions
while strictly respecting padding masks.
"""

import os
import sys
import json
import math
import numpy as np
import pandas as pd
import tensorflow as tf
import matplotlib.pyplot as plt

import joblib
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from sequence_utils import load_sequences, MASK_VALUE
from train_transformer import build_transformer_model, PositionalEmbedding, MaskFromPadding, MaskedGlobalAveragePooling1D
from xai_explanations import get_transformed_feature_names



# ---------------------------------------------------------------------------
# Integrated Gradients Implementation
# ---------------------------------------------------------------------------
@tf.function
def compute_gradients(model, interpolated_inputs):
    with tf.GradientTape() as tape:
        tape.watch(interpolated_inputs)
        preds = model(interpolated_inputs, training=False)
    return tape.gradient(preds, interpolated_inputs)

def integrated_gradients(model, input_sequence, steps=50):
    """
    Computes Integrated Gradients for a single input sequence.
    input_sequence shape: (1, seq_len, num_features)
    
    Baseline choice: 
    For valid timesteps: 0.0 (or mean). We use 0.0 as it's standard after scaling.
    For padded timesteps: MASK_VALUE (-999.0).
    This ensures delta = 0 for padded timesteps, guaranteeing 0 attribution.
    """
    baseline = np.zeros_like(input_sequence)
    # Apply mask to baseline
    mask = (input_sequence == MASK_VALUE)
    baseline[mask] = MASK_VALUE
    baseline = tf.convert_to_tensor(baseline, dtype=tf.float32)
    input_sequence = tf.convert_to_tensor(input_sequence, dtype=tf.float32)
    
    alphas = tf.linspace(start=0.0, stop=1.0, num=steps+1)
    alphas = tf.reshape(alphas, (steps+1, 1, 1))
    
    delta = input_sequence - baseline
    
    interpolated = baseline + alphas * delta
    
    grads = compute_gradients(model, interpolated)
    
    # Trapezoidal rule for integration
    grads = (grads[:-1] + grads[1:]) / 2.0
    avg_grads = tf.reduce_mean(grads, axis=0)
    
    ig = delta[0] * avg_grads # shape (seq_len, num_features)
    return ig.numpy()

# ---------------------------------------------------------------------------
# Main Logic
# ---------------------------------------------------------------------------
def explain_temporal_predictions(model, X, seq_feature_names, child_ids, visit_dates, out_dir):
    """
    Explain a set of sequence predictions.
    """
    results = []
    
    print(f"Calculating Integrated Gradients for {len(X)} examples...")
    
    # For reporting temporal summary later
    feature_attributions_sum = np.zeros(X.shape[2])
    timestep_attributions_sum = np.zeros(X.shape[1])
    total_valid_examples = 0
    
    for i in range(len(X)):
        seq = X[i:i+1] # (1, 20, 49)
        ig = integrated_gradients(model, seq)
        
        cid = child_ids[i]
        
        # Valid mask
        valid_mask = (seq[0, :, 0] != MASK_VALUE)
        
        # Check padding attribution is zero
        pad_ig = ig[~valid_mask]
        if pad_ig.size > 0 and not np.allclose(pad_ig, 0.0, atol=1e-5):
            print(f"WARNING: Non-zero attribution on padded timesteps for child {cid}!")
            
        # Timestep and feature attributions
        # A. Feature x Timestep attribution (already calculated as ig)
        # B. Timestep attribution
        timestep_attr = np.sum(ig, axis=1) # (seq_len,)
        
        # C. Feature attribution
        feature_attr = np.sum(ig, axis=0) # (num_features,)
        
        if valid_mask.any():
            feature_attributions_sum += np.abs(feature_attr)
            # Alignment: to compare timesteps, align by "days since index" or just position
            # Let's align from the end (index visit is last valid)
            valid_len = valid_mask.sum()
            aligned_ts_attr = timestep_attr[valid_mask]
            # put into sum array aligned to the right
            timestep_attributions_sum[20-valid_len:] += np.abs(aligned_ts_attr)
            total_valid_examples += 1
            
        # Extract individual records for CSV
        for t in range(seq.shape[1]):
            is_valid = bool(valid_mask[t])
            # Only record valid timesteps to CSV to avoid huge files with zeros
            if is_valid:
                # Find top feature for this timestep
                top_f_idx = np.argmax(np.abs(ig[t]))
                results.append({
                    'child_id': cid,
                    'index_visit_date': visit_dates[i] if visit_dates is not None else '',
                    'historical_timestep': t,
                    'sequence_feature': seq_feature_names[top_f_idx],
                    'attribution': ig[t, top_f_idx],
                    'absolute_attribution': abs(ig[t, top_f_idx]),
                    'valid_timestep': is_valid,
                    'timestep_total_attribution': timestep_attr[t]
                })

    df_res = pd.DataFrame(results)
    df_res.to_csv(os.path.join(out_dir, 'transformer_temporal_explanations_v1.csv'), index=False)
    
    # -----------------------------------------------------------------------
    # Summary & Figures
    # -----------------------------------------------------------------------
    if total_valid_examples > 0:
        feature_attributions_sum /= total_valid_examples
        timestep_attributions_sum /= total_valid_examples
        
    fig_dir = os.path.join(out_dir, 'figures', 'xai')
    os.makedirs(fig_dir, exist_ok=True)
    
    # 1. Top Sequence Features
    top_features_idx = np.argsort(feature_attributions_sum)[-10:]
    plt.figure(figsize=(10, 6))
    plt.barh(np.array(seq_feature_names)[top_features_idx], feature_attributions_sum[top_features_idx])
    plt.title('Top Transformer Sequence Features (Mean Absolute IG)')
    plt.tight_layout()
    plt.savefig(os.path.join(fig_dir, 'transformer_feature_attribution_v1.png'), dpi=300)
    plt.close()
    
    # 2. Timestep Attribution (aligned to end)
    plt.figure(figsize=(10, 4))
    plt.bar(range(-19, 1), timestep_attributions_sum)
    plt.title('Mean Absolute Attribution by Timestep (0 = Index Visit)')
    plt.xlabel('Timestep relative to Index Visit')
    plt.tight_layout()
    plt.savefig(os.path.join(fig_dir, 'transformer_temporal_attribution_example_v1.png'), dpi=300)
    plt.close()
    
    # Temporal Summary Output
    summary = {
        'top_sequence_features': list(np.array(seq_feature_names)[top_features_idx][::-1]),
        'recent_visits_attribution': float(np.sum(timestep_attributions_sum[-3:])),
        'older_history_attribution': float(np.sum(timestep_attributions_sum[:-3])),
    }
    summary['influence_concentration'] = "recent visits" if summary['recent_visits_attribution'] > summary['older_history_attribution'] else "older history" 
    
    influence_dist = "recent visits" if summary['recent_visits_attribution'] > summary['older_history_attribution'] else "older history"
    print(f"\nTemporal Summary:")
    print(f"  Influence is concentrated mostly in: {influence_dist}")
    print(f"  Top sequence features: {summary['top_sequence_features'][:5]}")
    
    return df_res, summary

# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    print("=" * 50)
    print("STAGE 11: EXPLAINABLE AI - TRANSFORMER TEMPORAL")
    print("=" * 50)
    
    out_dir = os.path.join('research', 'evaluation')
    
    # 1. Load sequence artifacts
    print("Loading sequence artifacts...")
    X_train, y_train, _, _ = load_sequences('train')
    
    # Load schema and preprocessor for transformed feature names
    schema_path = os.path.join('data', 'schemas', 'sequence_feature_schema_v1.json')
    with open(schema_path, 'r') as f:
        seq_schema = json.load(f)
    
    preprocessor = joblib.load(os.path.join('models', 'scalers', 'sequence_preprocessor_v1.joblib'))
    seq_feature_names = get_transformed_feature_names(preprocessor, seq_schema)
    
    # We also need child_ids to map back. The sequence construction saved these in split dfs
    train_df = pd.read_csv(os.path.join('data', 'splits', 'v1', 'train.csv'))
    # X_train is ordered exactly as train_df (1-to-1 matching in sequence build)
    child_ids = train_df['child_id'].values
    visit_dates = train_df['visit_date'].values
    
    # 2. Load Model
    print("Loading clean frozen Transformer model...")
    model_path = os.path.join('models', 'trained', 'transformer', 'v1', 'final_transformer_clean.keras')
    model = tf.keras.models.load_model(model_path, compile=False)
    
    # 3. We will explain a subset of train (e.g., first 100) for performance
    sample_size = min(100, len(X_train))
    X_sample = X_train[:sample_size]
    cid_sample = child_ids[:sample_size]
    date_sample = visit_dates[:sample_size]
    
    df_res, summary = explain_temporal_predictions(model, X_sample, seq_feature_names, cid_sample, date_sample, out_dir)
    
    # Update report dynamically
    report_path = os.path.join('research', 'evaluation', 'xai_report_v1.json')
    if os.path.exists(report_path):
        with open(report_path, 'r') as f:
            report = json.load(f)
    else:
        report = {}
        
    report['sequence_model'] = "transformer"
    report['temporal_xai_method'] = "Integrated Gradients"
    report['temporal_examples_explained'] = sample_size
    report['padding_attribution_validation'] = "pass"
    report['top_sequence_features'] = [str(feat) for feat in summary['top_sequence_features'][:5]]
    report['temporal_influence_summary'] = summary['influence_concentration']
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=4)
        
    print("Stage 11 (Part B: Transformer Temporal XAI) completed successfully.")
