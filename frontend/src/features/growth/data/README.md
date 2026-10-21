# WHO chart reference asset

`who-percentiles.json` copies the published 3rd, 15th, 50th, 85th and 97th
percentiles from four official WHO expanded daily tables. It contains separate
weight-for-age and length/height-for-age data for boys and girls, covering days
0–1856. These are reference population curves, never child measurements.

Sources:

- [WHO weight-for-age tables](https://www.who.int/tools/child-growth-standards/standards/weight-for-age)
- [WHO length/height-for-age tables](https://www.who.int/toolkits/child-growth-standards/standards/length-height-for-age)
- [WHO instructions for constructing charts](https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/instructions-en.pdf)

Each dataset records its source workbook URL and SHA-256. Values are copied
directly, with no LMS calculation, percentile estimation, rounding, or changes
to backend WHO processing. The frontend uses WHO's documented conversion
`1 month = 30.4375 days` solely for plotting exact visit ages. API `age_days`
is preferred; missing ages use the existing calendar-day utility and birth date.
Without usable ages, the chart preserves the date-based view. Without a matching
profile and supported biological sex, only recorded measurements are shown.

The length/height reference curves are split between days 730 and 731, retaining
WHO's documented measurement-method discontinuity. No child measurements are
converted. Connecting saved points is visual only; missing measurements stay
gaps. Tooltips do not estimate a child's percentile or recalculate WAZ/HAZ.

To reproduce or verify the asset, download the four `source_url` workbooks to a
temporary directory, naming them `wfa-boys.xlsx`, `wfa-girls.xlsx`,
`lhfa-boys.xlsx`, and `lhfa-girls.xlsx`, then run from the repository root:

```powershell
python frontend/scripts/import-who-chart-reference.py SOURCE_DIRECTORY --check
```

Omit `--check` to regenerate. The importer checks the pinned original workbook
hashes, exact daily coverage, finite positive values, and percentile ordering.
It requires only Python's standard library and writes only this frontend asset.
