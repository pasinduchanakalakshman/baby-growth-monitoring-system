import pandas as pd
import numpy as np
import json
import os
import sys

def parse_bool(val, col_name, row_idx, unparsed_list):
    if pd.isna(val):
        return pd.NA
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    if s in ['true', '1', 'yes', '1.0']:
        return True
    if s in ['false', '0', 'no', '0.0']:
        return False
    
    unparsed_list.append({'row': row_idx, 'column': col_name, 'value': val})
    return pd.NA

def clean_data(df, report):
    # 2. String Normalization
    string_cols = ['child_id', 'sex', 'delivery_type', 'supplement_type', 'food_groups_consumed']
    for col in string_cols:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: str(x).strip() if pd.notna(x) else x)
            
    # 3. Date Normalization
    date_cols = ['date_of_birth', 'visit_date']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')
            
    # 4. Numeric Normalization
    numeric_cols = [
        'birth_weight_kg', 'birth_length_cm', 'gestational_age_weeks', 'birth_order',
        'apgar_score_5min', 'age_days', 'weight_kg', 'length_height_cm',
        'breastfeeding_frequency_per_day', 'formula_feeds_per_day', 
        'complementary_feeding_start_age_months', 'meals_per_day', 'illness_duration_days'
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            
    # 5. Boolean Normalization
    bool_cols = [
        'breastfeeding_status', 'formula_feeding', 'complementary_feeding_started',
        'supplement_use', 'recent_illness', 'diarrhea_recent', 'fever_recent',
        'respiratory_illness_recent'
    ]
    unparsed_bools = []
    for col in bool_cols:
        if col in df.columns:
            df[col] = [parse_bool(val, col, idx, unparsed_bools) for idx, val in df[col].items()]
            df[col] = df[col].astype('boolean')
            
    report['boolean_normalization_summary']['unparseable_values'] = unparsed_bools
    
    # 6. Date and Age Consistency
    if all(c in df.columns for c in ['date_of_birth', 'visit_date']):
        calculated_age_days = (df['visit_date'] - df['date_of_birth']).dt.days
        
        if 'age_days' in df.columns:
            inconsistencies = (df['age_days'] != calculated_age_days) & df['age_days'].notna() & calculated_age_days.notna()
            report['age_inconsistencies'] = int(inconsistencies.sum())
        else:
            df['age_days'] = np.nan
            
        df.loc[calculated_age_days.notna(), 'age_days'] = calculated_age_days
        
        invalid_dates_mask = (df['age_days'] < 0) | (df['age_days'] > 1826) | (df['visit_date'] < df['date_of_birth'])
        report['invalid_dates'] = int(invalid_dates_mask.sum())
        
    # 7. Static Child Data Consistency
    static_cols = ['sex', 'date_of_birth', 'birth_weight_kg', 'birth_length_cm', 'gestational_age_weeks', 'birth_order', 'delivery_type', 'apgar_score_5min']
    static_cols = [c for c in static_cols if c in df.columns]
    
    if 'child_id' in df.columns:
        for col in static_cols:
            nunique_per_child = df.dropna(subset=[col]).groupby('child_id')[col].nunique()
            conflicting_children = nunique_per_child[nunique_per_child > 1]
            if not conflicting_children.empty:
                report['static_child_field_conflicts'][col] = int(len(conflicting_children))
                report['warnings'].append(f"Static field '{col}' has conflicts for {len(conflicting_children)} children.")
            else:
                report['static_child_field_conflicts'][col] = 0

    # 8. Longitudinal Ordering
    if all(c in df.columns for c in ['child_id', 'visit_date']):
        df = df.sort_values(by=['child_id', 'visit_date']).reset_index(drop=True)
        duplicates = df.duplicated(subset=['child_id', 'visit_date'])
        report['duplicate_child_visit_records'] = int(duplicates.sum())
        
    # 9. Conditional Missingness
    if 'complementary_feeding_started' in df.columns and 'complementary_feeding_start_age_months' in df.columns:
        exp_miss = ((df['complementary_feeding_started'] == False) & df['complementary_feeding_start_age_months'].isna()).sum()
        unexp_miss = ((df['complementary_feeding_started'] == True) & df['complementary_feeding_start_age_months'].isna()).sum()
        report['conditional_missingness']['complementary_feeding_expected_missing'] = int(exp_miss)
        report['conditional_missingness']['complementary_feeding_unexpected_missing'] = int(unexp_miss)
        
    if 'supplement_use' in df.columns and 'supplement_type' in df.columns:
        exp_miss = ((df['supplement_use'] == False) & df['supplement_type'].isna()).sum()
        unexp_miss = ((df['supplement_use'] == True) & df['supplement_type'].isna()).sum()
        report['conditional_missingness']['supplement_expected_missing'] = int(exp_miss)
        report['conditional_missingness']['supplement_unexpected_missing'] = int(unexp_miss)
        
    if 'recent_illness' in df.columns and 'illness_duration_days' in df.columns:
        exp_miss = ((df['recent_illness'] == False) & df['illness_duration_days'].isna()).sum()
        unexp_miss = ((df['recent_illness'] == True) & df['illness_duration_days'].isna()).sum()
        report['conditional_missingness']['illness_expected_missing'] = int(exp_miss)
        report['conditional_missingness']['illness_unexpected_missing'] = int(unexp_miss)
        
    # 10. Boolean / Frequency Logic Contradictions
    if 'breastfeeding_status' in df.columns and 'breastfeeding_frequency_per_day' in df.columns:
        contradiction = ((df['breastfeeding_status'] == False) & (df['breastfeeding_frequency_per_day'] > 0)).sum()
        if contradiction > 0:
            report['logical_contradictions'].append({'type': 'breastfeeding_false_but_freq_gt_0', 'count': int(contradiction)})
        neg_freq = (df['breastfeeding_frequency_per_day'] < 0).sum()
        if neg_freq > 0:
            report['logical_contradictions'].append({'type': 'breastfeeding_freq_negative', 'count': int(neg_freq)})
            
    if 'formula_feeding' in df.columns and 'formula_feeds_per_day' in df.columns:
        contradiction = ((df['formula_feeding'] == False) & (df['formula_feeds_per_day'] > 0)).sum()
        if contradiction > 0:
            report['logical_contradictions'].append({'type': 'formula_false_but_freq_gt_0', 'count': int(contradiction)})
        neg_freq = (df['formula_feeds_per_day'] < 0).sum()
        if neg_freq > 0:
            report['logical_contradictions'].append({'type': 'formula_freq_negative', 'count': int(neg_freq)})
            
    # 11. Anthropometric Validation
    for col in ['weight_kg', 'birth_weight_kg', 'length_height_cm', 'birth_length_cm']:
        if col in df.columns:
            invalid = (df[col] <= 0).sum()
            if invalid > 0:
                report['invalid_anthropometric_values'].append({'column': col, 'non_positive_count': int(invalid)})
                
    # 12. Height missingness
    if 'length_height_cm' in df.columns:
        report['height_missing_count'] = int(df['length_height_cm'].isna().sum())
        report['height_available_count'] = int(df['length_height_cm'].notna().sum())
        
    # 13. ML Leakage Check
    leakage_terms = ['target', 'future', 'prediction', 'predicted', 'next_visit', 'risk_score', 'risk_probability']
    for col in df.columns:
        if any(term in col.lower() for term in leakage_terms):
            report['warnings'].append(f"Potential leakage column detected: {col}")
            
    # Finish up
    report['output_rows'] = len(df)
    return df

def process_file():
    print("==================================================")
    print("STARTING DATA CLEANING")
    print("==================================================")
    
    input_path = os.path.join('data', 'raw', 'chdr_dataset_v1.csv')
    output_path = os.path.join('data', 'interim', 'chdr_cleaned_v1.csv')
    report_path = os.path.join('research', 'evaluation', 'data_cleaning_report_v1.json')
    
    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        sys.exit(1)
        
    df = pd.read_csv(input_path)
    input_rows = len(df)
    
    report = {
        "input_file": input_path,
        "output_file": output_path,
        "input_rows": input_rows,
        "unique_children": int(df['child_id'].nunique()) if 'child_id' in df.columns else 0,
        "invalid_dates": 0,
        "age_inconsistencies": 0,
        "duplicate_child_visit_records": 0,
        "static_child_field_conflicts": {},
        "boolean_normalization_summary": {"unparseable_values": []},
        "conditional_missingness": {
            "complementary_feeding_expected_missing": 0,
            "complementary_feeding_unexpected_missing": 0,
            "supplement_expected_missing": 0,
            "supplement_unexpected_missing": 0,
            "illness_expected_missing": 0,
            "illness_unexpected_missing": 0
        },
        "logical_contradictions": [],
        "invalid_anthropometric_values": [],
        "height_missing_count": 0,
        "height_available_count": 0,
        "rows_removed": 0,
        "rows_modified": 0,
        "warnings": []
    }
    
    df = clean_data(df, report)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=4)
        
    print(f"Data cleaning completed. Cleaned dataset saved to {output_path}")
    print(f"Report saved to {report_path}")

def main():
    process_file()
    
if __name__ == '__main__':
    main()
