import pandas as pd
import numpy as np
import os
import sys

def main():
    old_path = os.path.join('data', 'processed', 'chdr_who_features_v1_old.csv')
    new_path = os.path.join('data', 'processed', 'chdr_who_features_v1.csv')
    
    if not os.path.exists(old_path) or not os.path.exists(new_path):
        print("Missing files for comparison. Ensure both old and new exist.")
        sys.exit(1)
        
    old_df = pd.read_csv(old_path)
    new_df = pd.read_csv(new_path)
    
    waz_diff = (new_df['verified_waz'] - old_df['verified_waz']).abs()
    haz_diff = (new_df['verified_haz'] - old_df['verified_haz']).abs()
    
    print("==================================================")
    print("STAGE 3 REFINEMENT: NUMERICAL DIFFERENCE REPORT")
    print("==================================================")
    print(f"Mean absolute WAZ difference: {waz_diff.mean():.6f}")
    print(f"Maximum absolute WAZ difference: {waz_diff.max():.6f}")
    print(f"Mean absolute HAZ difference: {haz_diff.mean():.6f}")
    print(f"Maximum absolute HAZ difference: {haz_diff.max():.6f}")
    print("==================================================")

if __name__ == '__main__':
    main()
