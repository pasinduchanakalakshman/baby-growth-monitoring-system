import os
import sys
import json
import hashlib
import argparse

def calculate_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def main():
    parser = argparse.ArgumentParser(description="Stage 12: Freeze Research Core Artifacts")
    parser.add_argument('--verify', action='store_true', help="Verify against existing checksums")
    args = parser.parse_args()

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    checksums_path = os.path.join(project_root, 'models', 'metadata', 'research_core_v1_checksums.json')

    # Define critical artifacts
    artifacts = [
        "data/processed/chdr_supervised_180d_v1.csv",
        "data/splits/v1/train.csv",
        "data/splits/v1/validation.csv",
        "data/splits/v1/test.csv",
        "models/trained/baselines/v1/xgboost.joblib",
        "models/scalers/baseline_preprocessor_v1.joblib",
        "models/metadata/final_risk_model_v1.json",
        "models/trained/transformer/v1/final_transformer_clean.keras",
        "models/metadata/final_sequence_model_v1.json",
        "data/external/WHO Standards/lhfa_boys_0-to-2-years_zscores.xlsx",
        "data/external/WHO Standards/lhfa_boys_2-to-5-years_zscores.xlsx",
        "data/external/WHO Standards/lhfa_girls_0-to-2-years_zscores.xlsx",
        "data/external/WHO Standards/lhfa_girls_2-to-5-years_zscores.xlsx",
        "data/external/WHO Standards/wfa_boys_0-to-5-years_zscores.xlsx",
        "data/external/WHO Standards/wfa_girls_0-to-5-years_zscores.xlsx",
        "models/metadata/baseline_feature_metadata_v1.json",
        "data/schemas/sequence_feature_schema_v1.json"
    ]

    if args.verify:
        if not os.path.exists(checksums_path):
            print(f"Error: Checksums file not found at {checksums_path}")
            sys.exit(1)
            
        with open(checksums_path, 'r') as f:
            checksum_data = json.load(f)
            
        saved_files = checksum_data.get('files', {})
        print("Verifying artifacts...")
        errors = False
        for rel_path, expected_hash in saved_files.items():
            abs_path = os.path.join(project_root, rel_path)
            if not os.path.exists(abs_path):
                print(f"FAIL: Missing file: {rel_path}")
                errors = True
                continue
                
            actual_hash = calculate_sha256(abs_path)
            if actual_hash != expected_hash:
                print(f"FAIL: Hash mismatch for {rel_path}")
                print(f"  Expected: {expected_hash}")
                print(f"  Actual:   {actual_hash}")
                errors = True
            else:
                print(f"PASS: {rel_path}")
                
        if errors:
            print("\nError: Verification failed. Frozen artifacts have been modified!")
            sys.exit(1)
        else:
            print("\nVerification successful. All frozen artifacts are intact.")
            sys.exit(0)

    else:
        print("Generating checksums for Research Core v1...")
        checksums = {}
        for rel_path in artifacts:
            abs_path = os.path.join(project_root, rel_path)
            if not os.path.exists(abs_path):
                print(f"Error: Cannot find critical artifact: {rel_path}")
                sys.exit(1)
            
            checksums[rel_path] = calculate_sha256(abs_path)
            
        checksum_data = {
            "version": "research-core-v1",
            "algorithm": "SHA256",
            "files": checksums
        }
        
        with open(checksums_path, 'w') as f:
            json.dump(checksum_data, f, indent=4)
            
        print(f"Successfully generated checksums for {len(artifacts)} critical artifacts.")
        print(f"Saved to: {checksums_path}")

if __name__ == '__main__':
    main()
