"""
KRX 상장(+ ETF/KR) 한글 종목명 JSON 생성용.
FinanceDataReader 필요: pip install finance-datareader
출력: vite-project/src/data/koreanListedNames.json
"""

from pathlib import Path

try:
    import FinanceDataReader as fdr  # noqa: WPS433
except ImportError as e:
    raise SystemExit(
        'FinanceDataReader가 없습니다. 실행: pip install finance-datareader',
    ) from e

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'vite-project' / 'src' / 'data' / 'koreanListedNames.json'

import json  # noqa: E402


def main() -> None:
    names: list[str] = []
    for listing in ('KRX', 'ETF/KR'):
        df = fdr.StockListing(listing)
        names.extend(df['Name'].dropna().astype(str).str.strip().tolist())

    uniq = sorted({n for n in names if n and len(n) >= 2})
    meta = {'source': ['FinanceDataReader KRX', 'FinanceDataReader ETF/KR'], 'count': len(uniq)}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({'meta': meta, 'names': uniq}, ensure_ascii=False),
        encoding='utf-8',
    )
    print(f'written {OUT} ({meta["count"]} names)', flush=True)


if __name__ == '__main__':
    main()
