"""
clean_transformer_artifact.py

Migrates the legacy frozen Transformer model (which contained Lambda layers
for masking) to the current clean architecture (using custom Keras layers:
MaskFromPadding and MaskedGlobalAveragePooling1D).

Performs exact weight transfer and verifies numerical equivalence of predictions.
"""

import os
import sys
import json
import math
import numpy as np
import tensorflow as tf
import keras

sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from sequence_utils import load_sequences, MASK_VALUE
from train_transformer import build_transformer_model

# ---------------------------------------------------------------------------
# Legacy Functions for loading old model
# ---------------------------------------------------------------------------
@keras.saving.register_keras_serializable(name="mask_fn")
def mask_fn(inputs):
    return tf.math.not_equal(inputs[:, :, 0], MASK_VALUE)

@keras.saving.register_keras_serializable(name="masked_pooling")
def masked_pooling(inputs):
    seq, mask = inputs
    mask_f = tf.cast(mask, seq.dtype)[:, :, tf.newaxis]
    seq_masked = seq * mask_f
    sum_pool = tf.reduce_sum(seq_masked, axis=1)
    valid_counts = tf.reduce_sum(mask_f, axis=1)
    valid_counts = tf.maximum(valid_counts, 1.0)
    return sum_pool / valid_counts

def main():
    print("==================================================")
    print("STAGE 11: CLEANING STALE TRANSFORMER ARTIFACT")
    print("==================================================")
    
    # 1. Load legacy model
    legacy_model_path = os.path.join('models', 'trained', 'transformer', 'v1', 'final_transformer.keras')
    print(f"Loading legacy artifact: {legacy_model_path}")
    legacy_model = tf.keras.models.load_model(legacy_model_path, compile=False)
    
    # 2. Build clean architecture
    # Shape is (20, 49) based on sequence preprocessing
    input_shape = (20, 49)
    print("Building clean architecture...")
    clean_model = build_transformer_model(input_shape)
    
    # 3. Transfer weights
    print("Transferring weights...")
    # The layers with weights should correspond exactly.
    # Let's map them. The names might be slightly different or exactly the same.
    # Legacy likely had: input_projection (Dense), pos_embedding (PositionalEmbedding),
    # transformer_block (TransformerBlock), dense/dropout/output.
    # If the architecture layers are identically named/ordered, set_weights works.
    
    # Check if they have the same number of weights
    legacy_weights = legacy_model.get_weights()
    clean_weights = clean_model.get_weights()
    
    if len(legacy_weights) != len(clean_weights):
        raise ValueError(f"Weight count mismatch! Legacy: {len(legacy_weights)}, Clean: {len(clean_weights)}")
        
    clean_model.set_weights(legacy_weights)
    print("Weights transferred successfully.")
    
    # 4. Verification
    print("Verifying prediction equivalence...")
    X_val, _, _, _ = load_sequences('validation')
    
    legacy_preds = legacy_model.predict(X_val, verbose=0).flatten()
    clean_preds = clean_model.predict(X_val, verbose=0).flatten()
    
    max_diff = np.max(np.abs(legacy_preds - clean_preds))
    print(f"Maximum absolute probability difference: {max_diff}")
    
    tolerance = 1e-6
    if max_diff > tolerance:
        raise ValueError(f"Equivalence check failed! Max diff {max_diff} > {tolerance}")
        
    print("Prediction equivalence VERIFIED.")
    
    # 5. Save clean model
    clean_model_path = os.path.join('models', 'trained', 'transformer', 'v1', 'final_transformer_clean.keras')
    clean_model.save(clean_model_path)
    print(f"Clean model saved to: {clean_model_path}")
    
    # 6. Update Metadata
    meta_path = os.path.join('models', 'metadata', 'final_sequence_model_v1.json')
    if os.path.exists(meta_path):
        with open(meta_path, 'r') as f:
            meta = json.load(f)
    else:
        meta = {}
        
    meta['original_artifact'] = legacy_model_path
    meta['clean_artifact'] = clean_model_path
    meta['retraining_performed'] = False
    meta['weight_transfer_performed'] = True
    meta['equivalence_tolerance'] = tolerance
    meta['max_prediction_difference'] = float(max_diff)
    
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=4)
        
    print("Metadata updated.")
    print("Stale artifact cleaning complete.")

if __name__ == '__main__':
    main()
