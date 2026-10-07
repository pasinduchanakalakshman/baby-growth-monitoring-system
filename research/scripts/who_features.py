import pandas as pd
import numpy as np
import os
import json
import sys

def calculate_zscore(x, l, m, s, is_weight=False):
    if pd.isna(x) or pd.isna(l) or pd.isna(m) or pd.isna(s) or x <= 0 or m <= 0 or s <= 0:
        return np.nan
    if l != 0:
        z = (((x / m) ** l) - 1) / (l * s)
    else:
        z = np.log(x / m) / s
        
    if not is_weight:
        return z
        
    # WHO restricted tail handling for weight-based indicators
    if z > 3:
        if l != 0:
            sd3 = m * ((1 + l * s * 3) ** (1 / l))
            sd2 = m * ((1 + l * s * 2) ** (1 / l))
        else:
            sd3 = m * np.exp(3 * s)
            sd2 = m * np.exp(2 * s)
        sd23 = sd3 - sd2
        z = 3 + (x - sd3) / sd23
    elif z < -3:
        if l != 0:
            sd3neg = m * ((1 - l * s * 3) ** (1 / l))
            sd2neg = m * ((1 - l * s * 2) ** (1 / l))
        else:
            sd3neg = m * np.exp(-3 * s)
            sd2neg = m * np.exp(-2 * s)
        sd23neg = sd2neg - sd3neg
        z = -3 + (x - sd3neg) / sd23neg
        
    return z

def load_who_ref(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"WHO reference file not found: {file_path}")
        
    df = pd.read_excel(file_path)
    df.columns = df.columns.str.strip()
    
    has_day = False
    if 'Day' in df.columns:
        df['age_days_ref'] = df['Day'].astype(float)
        has_day = True
    elif 'Month' in df.columns:
        df['age_days_ref'] = df['Month'].astype(float) * 30.4375
    else:
        raise ValueError(f"No Day or Month column found in {file_path}")
        
    for c in ['L', 'M', 'S']:
        if c not in df.columns:
            raise ValueError(f"Missing required LMS column '{c}' in {file_path}")
            
    df = df.dropna(subset=['L', 'M', 'S'])
    
    if df.duplicated(subset=['age_days_ref']).any():
        raise ValueError(f"Duplicate age reference keys found in {file_path}")
        
    return df[['age_days_ref', 'L', 'M', 'S']].copy(), has_day

def load_and_combine_lhfa(file_02, file_25):
    df1, hd1 = load_who_ref(file_02)
    df2, hd2 = load_who_ref(file_25)
    
    # WHO transition between day 730 (length) and 731 (height)
    df1 = df1[df1['age_days_ref'] <= 730]
    df2 = df2[df2['age_days_ref'] >= 731]
    
    combined = pd.concat([df1, df2], ignore_index=True)
    return combined, (hd1 and hd2)

def map_lms(child_df, ref_df, has_day, age_col='age_days'):
    if child_df.empty:
        return pd.Series([np.nan]*len(child_df), index=child_df.index), pd.Series([np.nan]*len(child_df), index=child_df.index), pd.Series([np.nan]*len(child_df), index=child_df.index)
        
    if has_day:
        # Exact match using map (avoids interpolation/nearest approx)
        # MUST cast to float to match the float64 index of ref_df
        age_lookup = child_df[age_col].astype(float)
        ref_idx = ref_df.set_index('age_days_ref')
        l = age_lookup.map(ref_idx['L'])
        m = age_lookup.map(ref_idx['M'])
        s = age_lookup.map(ref_idx['S'])
        return l, m, s
    else:
        # Fallback to merge_asof if exact day-level data is NOT available (i.e. only monthly provided)
        sorted_child = child_df.reset_index().sort_values(age_col)
        # Ensure age keys have same dtype
        sorted_child[age_col] = sorted_child[age_col].astype(float)
        sorted_ref = ref_df.sort_values('age_days_ref')
        sorted_ref['age_days_ref'] = sorted_ref['age_days_ref'].astype(float)
        
        merged = pd.merge_asof(
            sorted_child,
            sorted_ref,
            left_on=age_col,
            right_on='age_days_ref',
            direction='nearest'
        )
        merged = merged.set_index('index').loc[child_df.index]
        return merged['L'], merged['M'], merged['S']

def process_features():
    print("==================================================")
    print("STARTING STAGE 3: WHO FEATURE CALCULATION")
    print("==================================================")
    
    input_path = os.path.join('data', 'interim', 'chdr_cleaned_v1.csv')
    output_path = os.path.join('data', 'processed', 'chdr_who_features_v1.csv')
    report_path = os.path.join('research', 'evaluation', 'who_feature_report_v1.json')
    who_dir = os.path.join('data', 'external', 'WHO Standards')
    
    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        sys.exit(1)
        
    df = pd.read_csv(input_path)
    input_rows = len(df)
    
    report = {
        "input_file": input_path,
        "output_file": output_path,
        "input_rows": input_rows,
        "output_rows": 0,
        "unique_children": int(df['child_id'].nunique()) if 'child_id' in df.columns else 0,
        "who_reference_files": {},
        "reference_validation": {},
        "waz": {"calculated": 0, "missing": 0, "lookup_failures": 0, "statistics": {}},
        "haz": {"calculated": 0, "missing": 0, "lookup_failures": 0, "statistics": {}},
        "sex_mapping_failures": 0,
        "age_coverage_failures": 0,
        "invalid_measurements": 0,
        "warnings": []
    }
    
    # 1. Load WHO References
    wfa_boys_path = os.path.join(who_dir, 'wfa_boys_0-to-5-years_zscores.xlsx')
    wfa_girls_path = os.path.join(who_dir, 'wfa_girls_0-to-5-years_zscores.xlsx')
    lhfa_boys_02_path = os.path.join(who_dir, 'lhfa_boys_0-to-2-years_zscores.xlsx')
    lhfa_boys_25_path = os.path.join(who_dir, 'lhfa_boys_2-to-5-years_zscores.xlsx')
    lhfa_girls_02_path = os.path.join(who_dir, 'lhfa_girls_0-to-2-years_zscores.xlsx')
    lhfa_girls_25_path = os.path.join(who_dir, 'lhfa_girls_2-to-5-years_zscores.xlsx')
    
    report["who_reference_files"] = {
        "wfa_boys": wfa_boys_path,
        "wfa_girls": wfa_girls_path,
        "lhfa_boys": [lhfa_boys_02_path, lhfa_boys_25_path],
        "lhfa_girls": [lhfa_girls_02_path, lhfa_girls_25_path]
    }
    
    refs = {}
    try:
        refs['wfa_male'], hd_wm = load_who_ref(wfa_boys_path)
        refs['wfa_female'], hd_wf = load_who_ref(wfa_girls_path)
        refs['lhfa_male'], hd_hm = load_and_combine_lhfa(lhfa_boys_02_path, lhfa_boys_25_path)
        refs['lhfa_female'], hd_hf = load_and_combine_lhfa(lhfa_girls_02_path, lhfa_girls_25_path)
        
        refs_has_day = {
            'wfa_male': hd_wm,
            'wfa_female': hd_wf,
            'lhfa_male': hd_hm,
            'lhfa_female': hd_hf
        }
    except Exception as e:
        print(f"Error loading WHO references: {e}")
        sys.exit(1)
        
    report["reference_validation"] = {
        "wfa_male_age_min": float(refs['wfa_male']['age_days_ref'].min()),
        "wfa_male_age_max": float(refs['wfa_male']['age_days_ref'].max()),
        "wfa_female_age_min": float(refs['wfa_female']['age_days_ref'].min()),
        "wfa_female_age_max": float(refs['wfa_female']['age_days_ref'].max()),
        "lhfa_male_age_min": float(refs['lhfa_male']['age_days_ref'].min()),
        "lhfa_male_age_max": float(refs['lhfa_male']['age_days_ref'].max()),
        "lhfa_female_age_min": float(refs['lhfa_female']['age_days_ref'].min()),
        "lhfa_female_age_max": float(refs['lhfa_female']['age_days_ref'].max()),
        "missing_lms_values": 0,
        "duplicate_reference_keys": 0
    }
    
    # 2. Sex Normalization
    df['normalized_sex'] = df['sex'].astype(str).str.strip().str.lower()
    
    male_mask = df['normalized_sex'].isin(['male', 'm'])
    female_mask = df['normalized_sex'].isin(['female', 'f'])
    invalid_sex_mask = ~(male_mask | female_mask)
    
    report["sex_mapping_failures"] = int(invalid_sex_mask.sum())
    if invalid_sex_mask.sum() > 0:
        report["warnings"].append(f"Found {invalid_sex_mask.sum()} records with invalid sex.")
        
    df['verified_waz'] = np.nan
    df['verified_haz'] = np.nan
    
    # 3. Calculate WAZ
    for mask, sex_key in [(male_mask, 'wfa_male'), (female_mask, 'wfa_female')]:
        sub_df = df[mask].copy()
        if not sub_df.empty:
            l, m, s = map_lms(sub_df, refs[sex_key], refs_has_day[sex_key], 'age_days')
            waz = [calculate_zscore(w, ll, mm, ss, is_weight=True) for w, ll, mm, ss in zip(sub_df['weight_kg'], l, m, s)]
            df.loc[mask, 'verified_waz'] = waz
            
            # Count out of bounds (where l is nan because age was out of bounds)
            report["age_coverage_failures"] += int(l.isna().sum())
            
    # 4. Calculate HAZ
    for mask, sex_key in [(male_mask, 'lhfa_male'), (female_mask, 'lhfa_female')]:
        # Only calculate HAZ where length_height_cm is present
        haz_mask = mask & df['length_height_cm'].notna()
        sub_df = df[haz_mask].copy()
        if not sub_df.empty:
            l, m, s = map_lms(sub_df, refs[sex_key], refs_has_day[sex_key], 'age_days')
            haz = [calculate_zscore(h, ll, mm, ss) for h, ll, mm, ss in zip(sub_df['length_height_cm'], l, m, s)]
            df.loc[haz_mask, 'verified_haz'] = haz
            
    df = df.drop(columns=['normalized_sex'])
    
    # Sorting
    if all(c in df.columns for c in ['child_id', 'visit_date']):
        df = df.sort_values(by=['child_id', 'visit_date']).reset_index(drop=True)
        
    # 5. Output and stats
    report["output_rows"] = len(df)
    
    # WAZ stats
    report["waz"]["missing"] = int(df['verified_waz'].isna().sum())
    report["waz"]["calculated"] = len(df) - report["waz"]["missing"]
    
    if report["waz"]["calculated"] > 0:
        waz_stats = df['verified_waz'].describe().to_dict()
        report["waz"]["statistics"] = {k: float(v) if pd.notna(v) else None for k, v in waz_stats.items()}
        
    # HAZ stats
    report["haz"]["missing"] = int(df['verified_haz'].isna().sum())
    report["haz"]["calculated"] = len(df) - report["haz"]["missing"]
    
    if report["haz"]["calculated"] > 0:
        haz_stats = df['verified_haz'].describe().to_dict()
        report["haz"]["statistics"] = {k: float(v) if pd.notna(v) else None for k, v in haz_stats.items()}
        
    # Check invalid measurements implicitly handled
    report["invalid_measurements"] = int(((df['weight_kg'] <= 0).sum() + (df['length_height_cm'] <= 0).sum()))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=4)
        
    print(f"WHO features calculated. Dataset saved to {output_path}")
    print(f"Report saved to {report_path}")

if __name__ == '__main__':
    process_features()
