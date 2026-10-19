import keras
import tensorflow as tf
from tensorflow.keras import layers

MASK_VALUE = -999.0

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
    """
    Derives a boolean valid-timestep mask from raw inputs.
    A timestep is considered padding when the first feature equals MASK_VALUE (-999.0).
    Returns a bool tensor of shape (batch, seq_len).
    """
    def __init__(self, mask_value=MASK_VALUE, **kwargs):
        super().__init__(**kwargs)
        self.mask_value = mask_value
        self.supports_masking = True

    def call(self, inputs):
        return tf.math.not_equal(inputs[:, :, 0], self.mask_value)

    def get_config(self):
        config = super().get_config()
        config.update({"mask_value": self.mask_value})
        return config

@keras.saving.register_keras_serializable()
class MaskedGlobalAveragePooling1D(layers.Layer):
    """
    Mean-pooling over the time axis that explicitly excludes padded timesteps.
    Inputs: [sequence_tensor, boolean_mask]
    """
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.supports_masking = True

    def call(self, inputs):
        seq, mask = inputs
        mask_f = tf.cast(mask, seq.dtype)[:, :, tf.newaxis]
        seq_masked = seq * mask_f
        sum_pool = tf.reduce_sum(seq_masked, axis=1)
        valid_counts = tf.reduce_sum(mask_f, axis=1)
        valid_counts = tf.maximum(valid_counts, 1.0)
        return sum_pool / valid_counts

    def get_config(self):
        return super().get_config()

TRANSFORMER_CUSTOM_OBJECTS = {
    "PositionalEmbedding": PositionalEmbedding,
    "TransformerBlock": TransformerBlock,
    "MaskFromPadding": MaskFromPadding,
    "MaskedGlobalAveragePooling1D": MaskedGlobalAveragePooling1D,
}
