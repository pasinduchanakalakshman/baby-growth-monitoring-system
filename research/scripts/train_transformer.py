import os
import sys
import json
import time
import keras
import tensorflow as tf
from tensorflow.keras import layers
from sequence_utils import (
    set_seeds, load_sequences, compute_metrics, get_class_weights,
    get_common_callbacks, save_training_history, MASK_VALUE
)

@keras.saving.register_keras_serializable()
class PositionalEmbedding(layers.Layer):
    def __init__(self, sequence_length, output_dim, **kwargs):
        super().__init__(**kwargs)
        self.sequence_length = sequence_length
        self.output_dim = output_dim
        self.supports_masking = True
        self.position_embeddings = layers.Embedding(
            input_dim=sequence_length, output_dim=output_dim
        )

    def build(self, input_shape):
        self.position_embeddings.build((self.sequence_length,))
        super().build(input_shape)

    def call(self, inputs):
        positions = tf.range(start=0, limit=self.sequence_length, delta=1)
        embedded_positions = self.position_embeddings(positions)
        return inputs + embedded_positions

    def get_config(self):
        config = super().get_config()
        config.update({
            "sequence_length": self.sequence_length,
            "output_dim": self.output_dim,
        })
        return config

@keras.saving.register_keras_serializable()
class TransformerBlock(layers.Layer):
    def __init__(self, embed_dim, num_heads, ff_dim, rate=0.1, **kwargs):
        super().__init__(**kwargs)
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        self.ff_dim = ff_dim
        self.rate = rate
        self.supports_masking = True
        self.att = layers.MultiHeadAttention(num_heads=num_heads, key_dim=embed_dim)
        self.ffn = tf.keras.Sequential([
            layers.Dense(ff_dim, activation="relu"),
            layers.Dense(embed_dim),
        ])
        self.layernorm1 = layers.LayerNormalization(epsilon=1e-6)
        self.layernorm2 = layers.LayerNormalization(epsilon=1e-6)
        self.dropout1 = layers.Dropout(rate)
        self.dropout2 = layers.Dropout(rate)

    def build(self, input_shape):
        # Keras 3 MultiHeadAttention.build() takes query_shape + value_shape separately
        self.att.build(query_shape=input_shape, value_shape=input_shape)
        self.ffn.build(input_shape)
        self.layernorm1.build(input_shape)
        self.layernorm2.build(input_shape)
        super().build(input_shape)

    def call(self, inputs, training=None, mask=None):
        if mask is not None:
            attention_mask = mask[:, tf.newaxis, :]
        else:
            attention_mask = None
            
        attn_output = self.att(inputs, inputs, attention_mask=attention_mask)
        attn_output = self.dropout1(attn_output, training=training)
        out1 = self.layernorm1(inputs + attn_output)
        
        ffn_output = self.ffn(out1)
        ffn_output = self.dropout2(ffn_output, training=training)
        return self.layernorm2(out1 + ffn_output)

    def get_config(self):
        config = super().get_config()
        config.update({
            "embed_dim": self.embed_dim,
            "num_heads": self.num_heads,
            "ff_dim": self.ff_dim,
            "rate": self.rate,
        })
        return config

@keras.saving.register_keras_serializable()
class MaskFromPadding(layers.Layer):
    """Derives a boolean valid-timestep mask from raw inputs.

    A timestep is considered padding when the first feature equals MASK_VALUE.
    Returns a bool tensor of shape (batch, seq_len).
    """

    def __init__(self, mask_value=MASK_VALUE, **kwargs):
        super().__init__(**kwargs)
        self.mask_value = mask_value
        self.supports_masking = True

    def call(self, inputs):
        # inputs: (batch, seq_len, features)
        return tf.math.not_equal(inputs[:, :, 0], self.mask_value)

    def get_config(self):
        config = super().get_config()
        config.update({"mask_value": self.mask_value})
        return config


@keras.saving.register_keras_serializable()
class MaskedGlobalAveragePooling1D(layers.Layer):
    """Mean-pooling over the time axis that explicitly excludes padded timesteps.

    The layer takes two inputs:
        [sequence_tensor, boolean_mask]
    where boolean_mask is True for valid timesteps and False for padding.
    Padded positions never contribute to the sum or the denominator.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.supports_masking = True

    def call(self, inputs):
        seq, mask = inputs          # (batch, T, d), (batch, T)
        mask_f = tf.cast(mask, seq.dtype)[:, :, tf.newaxis]  # (batch, T, 1)
        seq_masked = seq * mask_f
        sum_pool = tf.reduce_sum(seq_masked, axis=1)         # (batch, d)
        valid_counts = tf.reduce_sum(mask_f, axis=1)         # (batch, 1)
        valid_counts = tf.maximum(valid_counts, 1.0)
        return sum_pool / valid_counts

    def get_config(self):
        return super().get_config()

def build_transformer_model(input_shape):
    """Build lightweight Transformer architecture."""
    inputs = tf.keras.Input(shape=input_shape)

    # 1. Derive padding mask (True = valid timestep, False = padding)
    mask = MaskFromPadding(mask_value=MASK_VALUE, name='mask_from_padding')(inputs)

    # 2. Input Projection
    embed_dim = 32
    x = layers.Dense(embed_dim, name='input_projection')(inputs)

    # 3. Positional Embedding
    x = PositionalEmbedding(sequence_length=input_shape[0], output_dim=embed_dim, name='pos_embedding')(x)

    # 4. Transformer Block with explicit attention mask
    x = TransformerBlock(embed_dim=embed_dim, num_heads=2, ff_dim=64, name='transformer_block')(x, mask=mask)

    # 5. Masked Global Average Pooling (padded timesteps excluded)
    x = MaskedGlobalAveragePooling1D(name='masked_avg_pool')([x, mask])

    # 6. Output Layers
    x = layers.Dropout(0.3)(x)
    x = layers.Dense(32, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    outputs = layers.Dense(1, activation="sigmoid")(x)

    model = tf.keras.Model(inputs=inputs, outputs=outputs, name="transformer_v1")
    return model

def main():
    print("==================================================")
    print("STARTING STAGE 9: TRANSFORMER TRAINING")
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
    model = build_transformer_model(input_shape)
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
    callbacks = get_common_callbacks('transformer')
    
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
    save_training_history(history, 'transformer')
    
    model_dir = os.path.join('models', 'trained', 'transformer', 'v1')
    os.makedirs(model_dir, exist_ok=True)
    model.save(os.path.join(model_dir, 'final_transformer.keras'))
    
    # Calculate Validation metrics
    y_prob = model.predict(X_val).flatten()
    val_metrics = compute_metrics(y_val, y_prob)
    
    # Get stopped epoch
    early_stop_cb = [cb for cb in callbacks if isinstance(cb, tf.keras.callbacks.EarlyStopping)][0]
    best_epoch = early_stop_cb.best_epoch if early_stop_cb.best_epoch is not None else 100
    
    # Save metadata for registry
    meta = {
        "model_type": "transformer",
        "version": "v1",
        "input_shape": list(input_shape),
        "parameter_count": int(param_count),
        "class_weights": {str(k): float(v) for k, v in class_weights.items()},
        "epochs_trained": len(history.epoch),
        "best_epoch": int(best_epoch),
        "training_time_seconds": float(train_time),
        "validation_metrics": val_metrics
    }
    
    meta_path = os.path.join('research', 'evaluation', 'transformer_metadata.json')
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=4)
        
    print(f"Validation PR-AUC: {val_metrics['pr_auc']:.4f}")
    print("Transformer training finished.")

if __name__ == '__main__':
    main()
