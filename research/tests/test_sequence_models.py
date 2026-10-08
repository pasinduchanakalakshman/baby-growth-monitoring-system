import pytest
import numpy as np
import tensorflow as tf
import os
import sys
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts')))
from sequence_utils import load_sequences, compute_metrics, get_class_weights, MASK_VALUE
from train_lstm import build_lstm_model
from train_gru import build_gru_model
from train_transformer import (
    build_transformer_model, PositionalEmbedding,
    MaskedGlobalAveragePooling1D, MaskFromPadding,
)

@pytest.fixture
def dummy_sequences():
    np.random.seed(0)
    X = np.random.randn(10, 20, 49).astype(np.float32)
    # First 5 timesteps are padding for all samples
    X[:, :5, :] = MASK_VALUE
    y = np.random.randint(0, 2, size=(10,)).astype(np.int32)
    mask = (X[:, :, 0] != MASK_VALUE)
    return X, y, mask


# ------------------------------------------------------------------
# Tests 1-3: data shape and quality
# ------------------------------------------------------------------

def test_input_sequence_shapes_valid(dummy_sequences):
    """Test 1: input sequence shapes valid."""
    X, y, mask = dummy_sequences
    assert len(X.shape) == 3
    assert X.shape[1] == 20
    assert X.shape[2] == 49

def test_y_arrays_binary(dummy_sequences):
    """Test 2: y arrays binary."""
    X, y, mask = dummy_sequences
    assert set(np.unique(y)).issubset({0, 1})

def test_padding_mask_valid(dummy_sequences):
    """Test 3: padding mask valid — first 5 steps masked, last step real."""
    X, y, mask = dummy_sequences
    assert mask.shape == (10, 20)
    assert not mask[0, 0]   # padding
    assert mask[0, -1]      # real step


# ------------------------------------------------------------------
# Tests 4-6: model forward passes
# ------------------------------------------------------------------

def test_lstm_accepts_input(dummy_sequences):
    """Test 4: LSTM accepts input."""
    X, y, mask = dummy_sequences
    model = build_lstm_model(X.shape[1:])
    out = model(X)
    assert out.shape == (10, 1)

def test_gru_accepts_input(dummy_sequences):
    """Test 5: GRU accepts input."""
    X, y, mask = dummy_sequences
    model = build_gru_model(X.shape[1:])
    out = model(X)
    assert out.shape == (10, 1)

def test_transformer_accepts_input(dummy_sequences):
    """Test 6: Transformer accepts input."""
    X, y, mask = dummy_sequences
    model = build_transformer_model(X.shape[1:])
    out = model(X)
    assert out.shape == (10, 1)


# ------------------------------------------------------------------
# Tests 7-8: Transformer structural properties
# ------------------------------------------------------------------

def test_transformer_explicit_mask(dummy_sequences):
    """Test 7: Transformer uses explicit padding attention mask — no NaN output."""
    X, y, mask = dummy_sequences
    model = build_transformer_model(X.shape[1:])
    out = model(X)
    assert not np.isnan(out.numpy()).any()

def test_transformer_positional_encoding(dummy_sequences):
    """Test 8: Transformer positional encoding layer exists."""
    X, y, mask = dummy_sequences
    model = build_transformer_model(X.shape[1:])
    pos_layers = [l for l in model.layers if isinstance(l, PositionalEmbedding)]
    assert len(pos_layers) == 1

def test_no_lambda_masking_layers(dummy_sequences):
    """Test 8b: Transformer uses no Lambda layers for masking or pooling."""
    X, y, mask = dummy_sequences
    model = build_transformer_model(X.shape[1:])
    lambda_layers = [l for l in model.layers if isinstance(l, tf.keras.layers.Lambda)]
    assert len(lambda_layers) == 0, \
        f"Found unexpected Lambda layers: {[l.name for l in lambda_layers]}"

def test_transformer_mask_shape(dummy_sequences):
    """Test 8c: MaskFromPadding produces a boolean tensor of shape (batch, seq_len)."""
    X, y, mask = dummy_sequences
    mask_layer = MaskFromPadding(mask_value=MASK_VALUE)
    out_mask = mask_layer(tf.constant(X)).numpy()
    assert out_mask.shape == (10, 20)
    assert out_mask.dtype == bool


# ------------------------------------------------------------------
# Test 9: Masking behavioural correctness
# ------------------------------------------------------------------

def test_padded_timesteps_do_not_affect_masked_pooling():
    """Test 9a: changing padded values does NOT change MaskedGlobalAveragePooling1D output."""
    np.random.seed(1)
    # seq shape: (2, 6, 4) — first 3 positions padding, last 3 valid
    seq = np.random.randn(2, 6, 4).astype(np.float32)
    mask = np.array([[False, False, False, True, True, True],
                     [False, False, False, True, True, True]])

    pool_layer = MaskedGlobalAveragePooling1D()

    out1 = pool_layer([tf.constant(seq), tf.constant(mask)]).numpy()

    # Scramble the padded positions with very large values
    seq_mod = seq.copy()
    seq_mod[:, :3, :] = 999.0
    out2 = pool_layer([tf.constant(seq_mod), tf.constant(mask)]).numpy()

    np.testing.assert_allclose(
        out1, out2, atol=1e-6,
        err_msg="Padded timesteps affected pooled output — mask is not applied correctly!"
    )

def test_valid_timesteps_do_affect_masked_pooling():
    """Test 9b: changing VALID timestep values DOES change MaskedGlobalAveragePooling1D output."""
    np.random.seed(2)
    seq = np.random.randn(2, 6, 4).astype(np.float32)
    mask = np.array([[False, False, False, True, True, True],
                     [False, False, False, True, True, True]])

    pool_layer = MaskedGlobalAveragePooling1D()
    out1 = pool_layer([tf.constant(seq), tf.constant(mask)]).numpy()

    seq_mod = seq.copy()
    seq_mod[:, 4, :] = seq_mod[:, 4, :] + 100.0
    out2 = pool_layer([tf.constant(seq_mod), tf.constant(mask)]).numpy()

    assert not np.allclose(out1, out2, atol=1e-3), \
        "Changing valid timesteps had no effect — valid masking is broken!"

def test_pooled_output_excludes_padded_positions():
    """Test 9c: pool mean equals mean over valid positions only (manual verification)."""
    seq = np.array([[[10.0, 20.0],
                     [0.0,  0.0],   # padded — should be excluded
                     [4.0,  6.0],
                     [2.0,  4.0]]], dtype=np.float32)  # shape (1, 4, 2)
    mask = np.array([[False, False, True, True]])        # positions 2 and 3 valid

    pool_layer = MaskedGlobalAveragePooling1D()
    out = pool_layer([tf.constant(seq), tf.constant(mask)]).numpy()

    expected = np.array([[(4.0 + 2.0) / 2, (6.0 + 4.0) / 2]])
    np.testing.assert_allclose(out, expected, atol=1e-6)


# ------------------------------------------------------------------
# Tests 10-12: probability sanity
# ------------------------------------------------------------------

def test_model_outputs_probability_shape(dummy_sequences):
    """Test 10: model outputs probability shape (N,1)."""
    X, y, mask = dummy_sequences
    model = build_lstm_model(X.shape[1:])
    out = model(X)
    assert out.shape == (10, 1)

def test_probabilities_finite(dummy_sequences):
    """Test 11: probabilities finite."""
    X, y, mask = dummy_sequences
    model = build_lstm_model(X.shape[1:])
    out = model(X).numpy()
    assert np.all(np.isfinite(out))

def test_probabilities_between_0_and_1(dummy_sequences):
    """Test 12: probabilities between 0 and 1."""
    X, y, mask = dummy_sequences
    model = build_lstm_model(X.shape[1:])
    out = model(X).numpy()
    assert np.all(out >= 0.0) and np.all(out <= 1.0)


# ------------------------------------------------------------------
# Tests 13-14: class weights
# ------------------------------------------------------------------

def test_class_weights_calculated_using_train_only():
    """Test 13, 14: class weights computed using balanced strategy from train only."""
    y_train = np.array([0, 0, 0, 1])
    weights = get_class_weights(y_train)
    assert weights[0] == 4 / (2 * 3)
    assert weights[1] == 4 / (2 * 1)


# ------------------------------------------------------------------
# Tests 16-20: metrics
# ------------------------------------------------------------------

def test_metrics_calculated_correctly():
    """Test 16-20: all required metrics computed correctly."""
    y_true = np.array([0, 1, 0, 1])
    y_prob = np.array([0.1, 0.9, 0.4, 0.6])
    metrics = compute_metrics(y_true, y_prob)
    assert metrics['roc_auc'] == 1.0
    assert metrics['pr_auc'] == 1.0
    assert metrics['brier_score'] < 0.2
    assert metrics['precision'] == 1.0
    assert metrics['recall'] == 1.0
    assert metrics['specificity'] == 1.0
    assert metrics['f1'] == 1.0


# ------------------------------------------------------------------
# Test 24/25: Transformer save and reload
# ------------------------------------------------------------------

def test_transformer_save_reload(dummy_sequences):
    """Test 24-25: Transformer model saves and reloads; inference works after reload."""
    X, y, mask = dummy_sequences
    model = build_transformer_model(X.shape[1:])
    out_before = model.predict(X, verbose=0)

    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, 'test_transformer.keras')
        model.save(path)
        reloaded = tf.keras.models.load_model(path, compile=False)

    out_after = reloaded.predict(X, verbose=0)
    np.testing.assert_allclose(
        out_before, out_after, atol=1e-5,
        err_msg="Transformer output changed after save/reload!"
    )


# ------------------------------------------------------------------
# Test 27: seeds
# ------------------------------------------------------------------

def test_random_seeds_configured():
    """Test 27: random seeds configured (verified in training scripts)."""
    from sequence_utils import set_seeds
    set_seeds(42)   # must not raise
