import os
import json
import numpy as np
import pandas as pd
import tensorflow as tf
import random
from sklearn.metrics import (
    roc_auc_score, average_precision_score, precision_score, recall_score,
    f1_score, confusion_matrix, brier_score_loss
)
from sklearn.utils.class_weight import compute_class_weight

MASK_VALUE = -999.0

def set_seeds(seed=42):
    """Set random seeds for reproducibility."""
    os.environ['PYTHONHASHSEED'] = str(seed)
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)
    tf.config.experimental.enable_op_determinism()

def load_sequences(split):
    """Load X, y, mask, and index for a given split ('train', 'validation', 'test')."""
    base_dir = os.path.join('data', 'sequences', 'v1')
    X = np.load(os.path.join(base_dir, f'X_{split}.npy'))
    y = np.load(os.path.join(base_dir, f'y_{split}.npy'))
    mask = np.load(os.path.join(base_dir, f'mask_{split}.npy'))
    index_df = pd.read_csv(os.path.join(base_dir, f'index_{split}.csv'))
    return X, y, mask, index_df

def compute_metrics(y_true, y_prob, threshold=0.5):
    """Compute and return all required metrics."""
    y_pred = (y_prob >= threshold).astype(int)
    
    # Calculate ROC-AUC. Handle edge case of single class in true
    if len(np.unique(y_true)) > 1:
        roc_auc = roc_auc_score(y_true, y_prob)
        pr_auc = average_precision_score(y_true, y_prob)
    else:
        roc_auc = 0.0
        pr_auc = 0.0
        
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    brier = brier_score_loss(y_true, y_prob)
    
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    
    return {
        "roc_auc": float(roc_auc),
        "pr_auc": float(pr_auc),
        "precision": float(prec),
        "recall": float(rec),
        "f1": float(f1),
        "specificity": float(specificity),
        "brier_score": float(brier),
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp)
        }
    }

def get_class_weights(y_train):
    """Compute class weights using balanced strategy."""
    classes = np.unique(y_train)
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=y_train)
    return dict(zip(classes, weights))

def get_common_callbacks(model_name, monitor="val_loss", patience=10):
    """Get common callbacks for training."""
    early_stop = tf.keras.callbacks.EarlyStopping(
        monitor=monitor,
        patience=patience,
        restore_best_weights=True,
        verbose=1
    )
    reduce_lr = tf.keras.callbacks.ReduceLROnPlateau(
        monitor=monitor,
        factor=0.5,
        patience=5,
        min_lr=1e-5,
        verbose=1
    )
    return [early_stop, reduce_lr]

def save_training_history(history, model_name):
    """Save keras training history to csv and plot to figure."""
    hist_df = pd.DataFrame(history.history)
    hist_df.index.name = 'epoch'
    
    os.makedirs(os.path.join('research', 'evaluation'), exist_ok=True)
    os.makedirs(os.path.join('research', 'evaluation', 'figures'), exist_ok=True)
    
    hist_csv_path = os.path.join('research', 'evaluation', f'{model_name}_training_history_v1.csv')
    hist_df.to_csv(hist_csv_path)
    
    try:
        import matplotlib.pyplot as plt
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
        
        # Loss
        ax1.plot(hist_df['loss'], label='Train')
        if 'val_loss' in hist_df.columns:
            ax1.plot(hist_df['val_loss'], label='Validation')
        ax1.set_title(f'{model_name.upper()} Loss')
        ax1.set_xlabel('Epoch')
        ax1.set_ylabel('Loss')
        ax1.legend()
        
        # PR-AUC
        if 'pr_auc' in hist_df.columns:
            ax2.plot(hist_df['pr_auc'], label='Train PR-AUC')
            if 'val_pr_auc' in hist_df.columns:
                ax2.plot(hist_df['val_pr_auc'], label='Val PR-AUC')
            ax2.set_title(f'{model_name.upper()} PR-AUC')
            ax2.set_xlabel('Epoch')
            ax2.set_ylabel('PR-AUC')
            ax2.legend()
            
        plt.tight_layout()
        fig_path = os.path.join('research', 'evaluation', 'figures', f'{model_name}_training_curve.png')
        plt.savefig(fig_path)
        plt.close()
    except ImportError:
        print("matplotlib not installed, skipping plot generation.")
