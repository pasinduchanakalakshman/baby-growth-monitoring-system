"""Copy published WHO percentiles into chart assets, without calculating growth values.

Download the four source_url workbooks listed in who-percentiles.json into a local
directory as wfa-boys.xlsx, wfa-girls.xlsx, lhfa-boys.xlsx and lhfa-girls.xlsx.
Run: python frontend/scripts/import-who-chart-reference.py SOURCE_DIRECTORY [--check]
Only the pinned official files are accepted. No backend assets are read or changed.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

SOURCES = [
    ('weight', 'Male', 'wfa-boys', 'weight-for-age/expanded-tables', 'c4e251201c6cd352fbdd7797a7a298aff8c78b7525bd242fedec4494f3ccb095'),
    ('weight', 'Female', 'wfa-girls', 'weight-for-age/expanded-tables', '5bdfd79de222d0f660c1662adc02995e879374f5b3260571a357a2ec771da629'),
    ('height', 'Male', 'lhfa-boys', 'length-height-for-age/expandable-tables', '8e163405223fcdf749f6689a8b8233d15182117c8a8b87f46c957fcfc498c7f2'),
    ('height', 'Female', 'lhfa-girls', 'length-height-for-age/expandable-tables', '92b5b0306d87f32eeb1d0c68f32aceda55121ff9a2600af517ba2a5b8dc84851'),
]
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
COLUMNS = ['age_days', 'p3', 'p15', 'p50', 'p85', 'p97']


def published_rows(source: Path, expected_hash: str) -> list:
    if hashlib.sha256(source.read_bytes()).hexdigest() != expected_hash:
        raise ValueError(f'Unrecognized WHO source file: {source}')
    with ZipFile(source) as book:
        strings = [''.join(si.itertext()) for si in ET.fromstring(book.read('xl/sharedStrings.xml'))]
        sheet = ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
        records = []
        for row in sheet.findall('m:sheetData/m:row', NS):
            values = []
            for cell in row:
                value = cell.find('m:v', NS)
                if value is None:
                    raise ValueError('Unexpected empty WHO cell')
                values.append(strings[int(value.text)] if cell.get('t') == 's' else value.text)
            records.append(values)
    header, *records = records
    if header[0] not in ('Age', 'Day'):
        raise ValueError('Missing WHO age in days')
    indices = [0] + [header.index(column) for column in ('P3', 'P15', 'P50', 'P85', 'P97')]
    rows = [[int(row[0])] + [float(row[index]) for index in indices[1:]] for row in records]
    if [row[0] for row in rows] != list(range(1857)):
        raise ValueError('WHO daily coverage must be exactly 0 through 1856 days')
    for row in rows:
        if not all(math.isfinite(value) and value > 0 for value in row[1:]):
            raise ValueError('Invalid WHO percentile')
        if not all(a < b for a, b in zip(row[1:-1], row[2:])):
            raise ValueError('WHO percentiles must be ordered')
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_directory', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    output = Path(__file__).resolve().parents[1] / 'src/features/growth/data/who-percentiles.json'
    data = {
        'standard': 'WHO Child Growth Standards (2006)',
        'source_instructions': 'https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/instructions-en.pdf',
        'imported_on': '2026-10-21',
        'days_per_month': 30.4375,
        'length_last_day': 730,
        'height_first_day': 731,
        'columns': COLUMNS,
        'datasets': [],
    }
    for metric, sex, name, subdirectory, digest in SOURCES:
        data['datasets'].append({
            'metric': metric,
            'sex': sex,
            'source_url': f'https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/{subdirectory}/{name}-percentiles-expanded-tables.xlsx',
            'source_sha256': digest,
            'rows': published_rows(args.source_directory / (name + '.xlsx'), digest),
        })
    if args.check:
        if json.loads(output.read_text(encoding='utf-8')) != data:
            raise ValueError('Chart asset differs from the pinned WHO source tables')
        print('PASS: all 7,428 daily reference rows match the four official WHO workbooks exactly.')
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(data, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')
        print(f'Imported four WHO datasets to {output}')


if __name__ == '__main__':
    main()
