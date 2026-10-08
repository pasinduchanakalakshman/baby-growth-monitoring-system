import os

def fix_temporal_bug():
    path_temp = "research/scripts/temporal_xai.py"
    with open(path_temp, 'r') as f:
        content = f.read()
        
    old_summary_dict = """    summary = {
        'top_sequence_features': list(np.array(seq_feature_names)[top_features_idx][::-1]),
        'recent_visits_attribution': float(np.sum(timestep_attributions_sum[-3:])),
        'older_history_attribution': float(np.sum(timestep_attributions_sum[:-3]))
    }"""
    new_summary_dict = """    summary = {
        'top_sequence_features': list(np.array(seq_feature_names)[top_features_idx][::-1]),
        'recent_visits_attribution': float(np.sum(timestep_attributions_sum[-3:])),
        'older_history_attribution': float(np.sum(timestep_attributions_sum[:-3])),
    }
    summary['influence_concentration'] = "recent visits" if summary['recent_visits_attribution'] > summary['older_history_attribution'] else "older history" """
    content = content.replace(old_summary_dict, new_summary_dict)
    
    old_report_update = """    report['top_sequence_features'] = [str(feat) for feat in summary['top_features']]
    report['temporal_influence_summary'] = summary['influence_concentration']"""
    new_report_update = """    report['top_sequence_features'] = [str(feat) for feat in summary['top_sequence_features'][:5]]
    report['temporal_influence_summary'] = summary['influence_concentration']"""
    content = content.replace(old_report_update, new_report_update)

    with open(path_temp, 'w') as f:
        f.write(content)

if __name__ == "__main__":
    fix_temporal_bug()
    print("Fixed temporal bug.")
