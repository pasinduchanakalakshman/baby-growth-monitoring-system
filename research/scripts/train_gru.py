import os
import sys
import json
import time
import tensorflow as tf
from sequence_utils import (
    set_seeds, load_sequences, compute_metrics, get_class_weights,
    get_common_callbacks, save_training_history, MASK_VALUE
)

def build_gru_model(input_shape):
    """Build lightweight GRU architecture."""
    inputs = tf.keras.Input(shape=input_shape)
    
    # Masking layer to ignore padding (-999.0)
    x = tf.keras.layers.Masking(mask_value=MASK_VALUE)(inputs)
    
    # Lightweight GRU
    x = tf.keras.layers.GRU(64)(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    
    # Optional dense layer before output
    x = tf.keras.layers.Dense(32, activation='relu')(x)
    x = tf.keras.layers.Dropout(0.2)(x)
    
    outputs = tf.keras.layers.Dense(1, activation='sigmoid')(x)
    
    model = tf.keras.Model(inputs=inputs, outputs=outputs, name="gru_v1")
    return model

def main():
    print("==================================================")
    print("STARTING STAGE 9: GRU TRAINING")
    print("==================================================")
    
    # Set reproducibility
    set_seeds(42)
    print(f"TensorFlow Version: {tf.__version__}")
    
    # Load data
    print("Loading sequences...")
    X_train, y_train, mask_train, idx_train = load_sequences('train')
    X_val, y_val, mask_val, idx_val = load_sequences('validation')
    
    print(f"Train shape: {X_train.shape}")
    print(f"Validation shape: {X_val.shape}")
    
    # Verify shape
    assert X_train.shape == (5380, 20, 49)
    assert X_val.shape == (1143, 20, 49)
    
    input_shape = (X_train.shape[1], X_train.shape[2])
    
    # Class weights
    class_weights = get_class_weights(y_train)
    print(f"Using class weights (computed from TRAIN only): {class_weights}")
    
    # Build model
    model = build_gru_model(input_shape)
    model.summary()
    param_count = model.count_params()
    
    # Compile
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss=tf.keras.losses.BinaryCrossentropy(),
        metrics=[
            tf.keras.metrics.AUC(curve='PR', name='pr_auc'),
            tf.keras.metrics.AUC(curve='ROC', name='roc_auc')
        ]
    )
    
    # Callbacks
    callbacks = get_common_callbacks('gru')
    
    # Train
    print("Training model...")
    start_time = time.time()
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=100,
        batch_size=32,
        class_weight=class_weights,
        callbacks=callbacks,
        verbose=1
    )
    train_time = time.time() - start_time
    print(f"Training completed in {train_time:.2f} seconds")
    
    # Save artifacts
    save_training_history(history, 'gru')
    
    model_dir = os.path.join('models', 'trained', 'gru', 'v1')
    os.makedirs(model_dir, exist_ok=True)
    model.save(os.path.join(model_dir, 'final_gru.keras'))
    
    # Calculate Validation metrics
    y_prob = model.predict(X_val).flatten()
    val_metrics = compute_metrics(y_val, y_prob)
    
    # Get stopped epoch
    early_stop_cb = [cb for cb in callbacks if isinstance(cb, tf.keras.callbacks.EarlyStopping)][0]
    best_epoch = early_stop_cb.best_epoch if early_stop_cb.best_epoch is not None else 100
    
    # Save metadata for registry
    meta = {
        "model_type": "gru",
        "version": "v1",
        "input_shape": list(input_shape),
        "parameter_count": int(param_count),
        "class_weights": {str(k): float(v) for k, v in class_weights.items()},
        "epochs_trained": len(history.epoch),
        "best_epoch": int(best_epoch),
        "training_time_seconds": float(train_time),
        "validation_metrics": val_metrics
    }
    
    meta_path = os.path.join('research', 'evaluation', 'gru_metadata.json')
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=4)
        
    print(f"Validation PR-AUC: {val_metrics['pr_auc']:.4f}")
    print("GRU training finished.")

if __name__ == '__main__':
    main()
