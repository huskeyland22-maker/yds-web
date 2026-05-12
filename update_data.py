#!/usr/bin/env python3
"""
9대 패닉 지수 배치 업데이트
- 단기: 미국장 확정 일봉 종가(16:15 ET 이후 완료분만)
- 중장기·저신뢰 소스: Waterfall persistence (신규 → data.json → backup)
- 빈값/0/NaN으로 기존 정상값 덮어쓰기 금지
"""
from __future__ import annotations

import json
import math
import os
import sys
import traceback
from datetime import date, datetime, timedelta, time as time_of_day
from pathlib import Path
from typing import Any, Optional

import pandas as pd
import requests
import yfinance as yf

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    from backports.zoneinfo import ZoneInfo  # type: ignore

US_ET = ZoneInfo("America/New_York")
KST = ZoneInfo("Asia/Seoul")

CNN_FG_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
ALT_FG_URL = "https://api.alternative.me/fng/?limit=3"
FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2"

ROOT = Path(__file__).resolve().parent
OUT_JSON = ROOT / "vite-project" / "public" / "data.json"
BACKUP_JSON = OUT_JSON.with_suffix(".json.backup")
LOG_PATH = ROOT / "panic-update.log"

HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

TICKERS_SHORT = {
    "vix": "^VIX",
    "vxn": "^VXN",
    "skew": "^SKEW",
    "move": "^MOVE",
}

# Yahoo Finance에서 CBOE Put/Call 일봉 티커가 자주 폐지됨 -> PUTCALL_MANUAL 또는 FRED(PUTCALL_FRED_SERIES) 우선
PUTCALL_YF_CANDIDATES = ("^CPC", "^CPCE", "^PCCE", "^PCUS")

VALID_RANGE = {
    "vix": (5.0, 120.0),
    "vxn": (5.0, 120.0),
    "skew": (85.0, 200.0),
    "move": (25.0, 350.0),
    "putCall": (0.35, 2.5),
}

FRED_OBS_URL = "https://api.stlouisfed.org/fred/series/observations"

# 로컬 검증 출력용 (2026-05-11 월요일 확정치)
VERIFY_SESSION_DATE = "2026-05-11"
VERIFY_TARGETS = {
    "vix": 18.38,
    "vxn": 24.74,
    "skew": 140.21,
}


def log(msg: str) -> None:
    line = f"{datetime.now(KST).strftime('%Y-%m-%d %H:%M:%S')} KST {msg}"
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", errors="replace").decode("ascii"), flush=True)
    try:
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def now_kst_str() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")


def _bar_calendar_date(ts: Any) -> date:
    t = pd.Timestamp(ts)
    return t.date()


def _step_previous_weekday(d: date) -> date:
    d = d - timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def last_completed_us_equity_session_date(now_et: datetime) -> date:
    """
    일봉 종가에 매칭할 '가장 최근 완료된' 거래일(미국 동부, 16:15 ET 기준).
    - 주말 → 직전 금요일
    - 평일 16:15 이전 → 전 거래일(주말 스킵)
    (NYSE 휴장일은 미반영 — 휴장이면 히스토리에 행이 없어 후속 단계에서 ABORT)
    """
    cutoff = time_of_day(16, 15)
    cal = now_et.date()
    d = cal
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    if cal.weekday() < 5 and cal == d and now_et.time() < cutoff:
        d = _step_previous_weekday(d)
        while d.weekday() >= 5:
            d -= timedelta(days=1)
    return d


def fetch_daily_close_for_session_date(
    ticker: str,
    key: str,
    required_session_date: date,
    *,
    quiet: bool = False,
) -> tuple[Optional[float], Optional[str]]:
    """
    iloc[-1] 금지: required_session_date 와 일치하는 일봉 행만 사용.
    날짜가 맞는 행이 없거나, 당일 봉이 아직 미완성(16:15 ET 이전)이면 실패.
    """
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period="60d", interval="1d", auto_adjust=False)
    except Exception as e:
        if not quiet:
            log(f"[{key}] yfinance error: {e}")
        return None, None

    if hist is None or hist.empty:
        if not quiet:
            log(f"[{key}] empty history")
        return None, None

    now_et = datetime.now(US_ET)
    cutoff = time_of_day(16, 15)
    col = "Adj Close" if "Adj Close" in hist.columns else "Close"
    if col not in hist.columns:
        if not quiet:
            log(f"[{key}] no Close column")
        return None, None

    for i in range(len(hist) - 1, -1, -1):
        bar_d = _bar_calendar_date(hist.index[i])
        if bar_d != required_session_date:
            continue
        if bar_d == now_et.date() and now_et.time() < cutoff:
            if not quiet:
                log(
                    f"[{key}] ABORT candidate: session {required_session_date} bar not final yet "
                    f"(now ET {now_et.strftime('%Y-%m-%d %H:%M')})"
                )
            return None, None
        row = hist.iloc[i]
        raw = row[col]
        if raw is None or (isinstance(raw, float) and (math.isnan(raw) or math.isinf(raw))):
            continue
        val = float(raw)
        lo, hi = VALID_RANGE.get(key, (0.01, 1e9))
        if val <= 0 or not (lo <= val <= hi):
            if not quiet:
                log(f"[{key}] out of range or non-positive: {val}")
            return None, None
        return round(val, 4 if key == "putCall" else 2), bar_d.isoformat()

    if not quiet:
        log(
            f"[{key}] DATE CHECK FAIL: no daily row for required session {required_session_date} "
            f"(ticker={ticker}). Refusing stale iloc fallback."
        )
    return None, None


def vix_close_from_ticker_info(required_session_date: date) -> Optional[float]:
    """history 불안정 시 전일/직전 정규장 종가 후보를 .info에서 보조 조회."""
    try:
        info = yf.Ticker("^VIX").info
    except Exception as e:
        log(f"[vix] Ticker.info failed: {e}")
        return None
    if not isinstance(info, dict):
        return None
    for k in (
        "regularMarketPreviousClose",
        "previousClose",
        "chartPreviousClose",
    ):
        raw = info.get(k)
        if raw is None:
            continue
        try:
            val = float(raw)
        except (TypeError, ValueError):
            continue
        lo, hi = VALID_RANGE["vix"]
        if lo <= val <= hi:
            log(
                f"[vix] using Ticker.info['{k}']={val} as proxy close "
                f"(assign dataDate={required_session_date.isoformat()})"
            )
            return round(val, 2)
    log("[vix] Ticker.info has no usable previousClose-style field")
    return None


def fetch_vix_for_required_session(required_session_date: date) -> tuple[Optional[float], Optional[str]]:
    v, d = fetch_daily_close_for_session_date("^VIX", "vix", required_session_date)
    if v is not None:
        if d != required_session_date.isoformat():
            log(f"[vix] internal date mismatch: got {d}, need {required_session_date}")
            return None, None
        return v, d
    alt = vix_close_from_ticker_info(required_session_date)
    if alt is not None:
        return alt, required_session_date.isoformat()
    return None, None


def fred_latest_observation(series_id: str) -> tuple[Optional[float], Optional[str]]:
    key = (os.environ.get("FRED_API_KEY") or "").strip()
    if not key:
        return None, None
    params: dict[str, Any] = {
        "series_id": series_id,
        "api_key": key,
        "file_type": "json",
        "sort_order": "desc",
        "limit": 1,
    }
    try:
        r = requests.get(FRED_OBS_URL, params=params, timeout=25)
        r.raise_for_status()
        obs = r.json().get("observations") or []
        if not obs:
            return None, None
        raw = obs[0].get("value")
        ds = obs[0].get("date")
        if raw in (None, "."):
            return None, None
        return float(raw), str(ds) if ds else None
    except Exception as e:
        log(f"FRED {series_id}: {e}")
        return None, None


def fetch_put_call_live_candidate(required_session_date: date) -> tuple[Optional[float], Optional[str]]:
    """PUTCALL_MANUAL -> FRED(PUTCALL_FRED_SERIES) -> 후보 Yahoo 심볼 순 (일봉은 required_session_date 행만)."""
    m = manual_env_float("PUTCALL_MANUAL")
    if m is not None:
        lo, hi = VALID_RANGE["putCall"]
        if lo <= m <= hi:
            return round(m, 4), required_session_date.isoformat()

    series = (os.environ.get("PUTCALL_FRED_SERIES") or "").strip()
    if series:
        v, d = fred_latest_observation(series)
        if v is not None:
            lo, hi = VALID_RANGE["putCall"]
            if lo <= v <= hi:
                return round(v, 4), d

    for i, sym in enumerate(PUTCALL_YF_CANDIDATES):
        v, d = fetch_daily_close_for_session_date(
            sym, "putCall", required_session_date, quiet=(i < len(PUTCALL_YF_CANDIDATES) - 1)
        )
        if v is not None:
            return v, d
    log("[putCall] no live source (set PUTCALL_MANUAL or PUTCALL_FRED_SERIES+FRED_API_KEY)")
    return None, None


def extract_value(prev: Any) -> Optional[float]:
    if prev is None:
        return None
    if isinstance(prev, (int, float)):
        if isinstance(prev, float) and (math.isnan(prev) or math.isinf(prev)):
            return None
        return float(prev)
    if isinstance(prev, dict):
        v = prev.get("value")
        if v is None or v == "":
            return None
        try:
            x = float(v)
        except (TypeError, ValueError):
            return None
        if math.isnan(x) or math.isinf(x) or x == 0:
            return None
        return x
    return None


def extract_data_date(prev: Any) -> Optional[str]:
    if not isinstance(prev, dict):
        return None
    d = prev.get("dataDate") or prev.get("lastUpdated")
    return str(d) if d else None


def is_valid_persist_value(x: Optional[float], *, allow_zero: bool = False) -> bool:
    if x is None:
        return False
    if math.isnan(x) or math.isinf(x):
        return False
    if not allow_zero and x == 0:
        return False
    return True


def slot_live(
    value: float,
    data_date: Optional[str],
    updated_at: str,
    *,
    source_status: str = "live",
    fallback_used: bool = False,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "value": value,
        "updatedAt": updated_at,
        "sourceStatus": source_status,
        "fallbackUsed": fallback_used,
    }
    if data_date:
        out["dataDate"] = data_date
    return out


def merge_slot(
    key: str,
    live: Optional[dict[str, Any]],
    prev_doc: dict[str, Any],
    backup_doc: dict[str, Any],
    updated_at: str,
) -> dict[str, Any]:
    """Waterfall: live → prev → backup. 절대 null/0으로 덮어쓰지 않음."""
    prev_raw = prev_doc.get(key)
    backup_raw = backup_doc.get(key)

    if live and is_valid_persist_value(extract_value(live), allow_zero=False):
        return live

    for label, raw in ("previous", prev_raw), ("backup", backup_raw):
        v = extract_value(raw)
        if is_valid_persist_value(v, allow_zero=False):
            dd = extract_data_date(raw) if isinstance(raw, dict) else None
            base = raw if isinstance(raw, dict) else {}
            out = {
                "value": round(float(v), 4 if key == "putCall" else 2),
                "updatedAt": updated_at,
                "sourceStatus": "fallback",
                "fallbackUsed": True,
            }
            if dd:
                out["dataDate"] = dd
            elif isinstance(base, dict) and base.get("dataDate"):
                out["dataDate"] = base["dataDate"]
            if key in ("bofa", "gsBullBear"):
                if isinstance(base, dict) and base.get("lastUpdated"):
                    out["lastUpdated"] = base["lastUpdated"]
                elif out.get("dataDate"):
                    out["lastUpdated"] = out["dataDate"]
            return out

    log(f"[{key}] CRITICAL: no persisted value in prev or backup")
    return {
        "value": None,
        "updatedAt": updated_at,
        "sourceStatus": "missing",
        "fallbackUsed": True,
    }


def manual_env_float(name: str) -> Optional[float]:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        log(f"invalid env {name}={raw!r}")
        return None


def fetch_fear_greed() -> tuple[Optional[float], Optional[str], str]:
    """(score, data_date_iso, source_tag)"""
    try:
        r = requests.get(CNN_FG_URL, timeout=25, headers=HTTP_HEADERS)
        r.raise_for_status()
        data = r.json()
        fg = data.get("fear_and_greed") or {}
        score = fg.get("score")
        if score is None:
            raise ValueError("missing score")
        val = round(float(score), 2)
        if not (0 <= val <= 100):
            return None, None, "cnn"
        ts = fg.get("market_time") or fg.get("timestamp") or data.get("timestamp")
        data_date = None
        if isinstance(ts, (int, float)):
            data_date = datetime.fromtimestamp(float(ts) / (1000 if ts > 1e12 else 1), tz=US_ET).date().isoformat()
        elif isinstance(ts, str):
            try:
                data_date = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(US_ET).date().isoformat()
            except ValueError:
                data_date = None
        return val, data_date, "cnn"
    except Exception as e:
        log(f"CNN Fear&Greed failed: {e}")

    try:
        r = requests.get(ALT_FG_URL, timeout=20, headers=HTTP_HEADERS)
        r.raise_for_status()
        arr = r.json().get("data") or []
        if not arr:
            return None, None, "alt"
        row = arr[0]
        val = round(float(row["value"]), 2)
        ts = int(row.get("timestamp", 0))
        data_date = datetime.fromtimestamp(ts, tz=US_ET).date().isoformat() if ts else None
        if not (0 <= val <= 100):
            return None, None, "alt"
        return val, data_date, "alt"
    except Exception as e:
        log(f"alternative.me Fear&Greed failed: {e}")
        return None, None, "alt"


def fetch_hy_fred_csv() -> tuple[Optional[float], Optional[str]]:
    try:
        r = requests.get(FRED_CSV_URL, timeout=30)
        r.raise_for_status()
        lines = [ln for ln in r.text.splitlines() if ln.strip()]
        for row in reversed(lines[1:]):
            parts = row.split(",")
            if len(parts) < 2:
                continue
            ds = parts[0].strip()
            raw = parts[1].strip()
            if raw in ("", "."):
                continue
            val = float(raw)
            if val <= 0 or val > 25:
                return None, None
            return round(val, 3), ds
    except Exception as e:
        log(f"FRED HY CSV failed: {e}")
        return None, None


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception as e:
        log(f"read {path} failed: {e}")
        return {}


def validate_payload(doc: dict[str, Any]) -> bool:
    required = ("vix", "vxn", "skew", "move", "putCall", "fearGreed", "bofa", "highYield", "gsBullBear")
    for k in required:
        v = extract_value(doc.get(k))
        if not is_valid_persist_value(v, allow_zero=False):
            log(f"validate fail: {k} missing or invalid")
            return False
    fg = extract_value(doc.get("fearGreed"))
    if fg is None or not (0 <= fg <= 100):
        log("validate fail: fearGreed range")
        return False
    pc = extract_value(doc.get("putCall"))
    if pc is None or not (0.2 <= pc <= 3.0):
        log("validate fail: putCall range")
        return False
    bf = extract_value(doc.get("bofa"))
    if bf is None or not (0.1 <= bf <= 15.0):
        log("validate fail: bofa range")
        return False
    hy = extract_value(doc.get("highYield"))
    if hy is None or not (0.1 <= hy <= 25.0):
        log("validate fail: highYield range")
        return False
    gs = extract_value(doc.get("gsBullBear"))
    if gs is None or not (0 <= gs <= 100):
        log("validate fail: gsBullBear range")
        return False
    for k in ("vix", "vxn", "skew", "move"):
        v = extract_value(doc.get(k))
        lo, hi = VALID_RANGE[k]
        if v is None or not (lo <= v <= hi):
            log(f"validate fail: {k} range")
            return False
    return True


def print_session_verify_block(doc: dict[str, Any]) -> None:
    """로컬 실행 시 터미널에서 5/11 확정치 반영 여부를 바로 확인."""
    print("", flush=True)
    print("=== VERIFY (vs 2026-05-11 Monday session targets) ===", flush=True)
    print(f"  Target session date: {VERIFY_SESSION_DATE}", flush=True)
    all_ok = True
    for key, exp_val in VERIFY_TARGETS.items():
        slot = doc.get(key)
        dd = slot.get("dataDate") if isinstance(slot, dict) else None
        val = extract_value(slot)
        ok_d = dd == VERIFY_SESSION_DATE
        ok_v = val is not None and abs(float(val) - exp_val) < 0.06
        line_ok = ok_d and ok_v
        all_ok = all_ok and line_ok
        status = "OK" if line_ok else "MISMATCH"
        print(
            f"  {key.upper()}: value={val!r} (expect {exp_val})  dataDate={dd!r} (expect {VERIFY_SESSION_DATE})  -> {status}",
            flush=True,
        )
    print(f"  Overall: {'PASS' if all_ok else 'CHECK MANUALLY (market moved or session date differs)'}", flush=True)
    print("=== end verify ===", flush=True)


def build_bofa_gs_live(updated_at: str) -> tuple[Optional[dict[str, Any]], Optional[dict[str, Any]]]:
    """무료 API 없음 → 환경변수 수동값만 'live'로 간주."""
    bofa_v = manual_env_float("BOFA_MANUAL")
    gs_v = manual_env_float("GS_BULLBEAR_MANUAL")
    bofa_slot = None
    gs_slot = None
    today = datetime.now(US_ET).date().isoformat()
    if is_valid_persist_value(bofa_v, allow_zero=False) and bofa_v is not None:
        bofa_slot = slot_live(
            round(float(bofa_v), 2),
            today,
            updated_at,
            source_status="manual",
            fallback_used=False,
        )
    if is_valid_persist_value(gs_v, allow_zero=False) and gs_v is not None:
        gs_slot = slot_live(
            round(float(gs_v), 2),
            today,
            updated_at,
            source_status="manual",
            fallback_used=False,
        )
    return bofa_slot, gs_slot


def run_once() -> int:
    updated_at = now_kst_str()
    prev = load_json(OUT_JSON)
    backup = load_json(BACKUP_JSON)

    now_et = datetime.now(US_ET)
    required_session = last_completed_us_equity_session_date(now_et)
    log(
        f"Required US session date for daily bars: {required_session.isoformat()} "
        f"(now US/ET {now_et.strftime('%Y-%m-%d %H:%M')})"
    )

    doc: dict[str, Any] = {
        "schemaVersion": 2,
        "updatedAt": updated_at,
        "accessTier": "pro",
        "isStale": False,
    }

    any_fallback = False

    # --- 단기: 필수 거래일 행만 (날짜 불일치·누락 시 전체 중단, data.json 미변경) ---
    for key, ticker in TICKERS_SHORT.items():
        if key == "vix":
            val, bar_date = fetch_vix_for_required_session(required_session)
        else:
            val, bar_date = fetch_daily_close_for_session_date(ticker, key, required_session)
        if val is None or bar_date != required_session.isoformat():
            log(
                f"UPDATE ABORTED: short metric '{key}' missing or date mismatch "
                f"(need session {required_session.isoformat()}, got value={val!r} dataDate={bar_date!r}). "
                f"data.json not modified."
            )
            return 3
        doc[key] = slot_live(val, bar_date, updated_at, source_status="live", fallback_used=False)

    pc_v, pc_d = fetch_put_call_live_candidate(required_session)
    pc_live = (
        slot_live(pc_v, pc_d, updated_at, source_status="live", fallback_used=False) if pc_v is not None else None
    )
    doc["putCall"] = merge_slot("putCall", pc_live, prev, backup, updated_at)
    if doc["putCall"].get("fallbackUsed"):
        any_fallback = True

    # --- Fear & Greed ---
    fg_val, fg_date, _src = fetch_fear_greed()
    fg_live = None
    if fg_val is not None:
        fg_live = slot_live(fg_val, fg_date, updated_at, source_status="live", fallback_used=False)
    doc["fearGreed"] = merge_slot("fearGreed", fg_live, prev, backup, updated_at)
    if doc["fearGreed"].get("fallbackUsed"):
        any_fallback = True

    # --- HY ---
    hy_v, hy_date = fetch_hy_fred_csv()
    hy_live = None
    if hy_v is not None:
        hy_live = slot_live(hy_v, hy_date, updated_at, source_status="live", fallback_used=False)
    doc["highYield"] = merge_slot("highYield", hy_live, prev, backup, updated_at)
    if doc["highYield"].get("fallbackUsed"):
        any_fallback = True

    # --- BofA / GS: manual env + persistence ---
    bofa_live, gs_live = build_bofa_gs_live(updated_at)
    doc["bofa"] = merge_slot("bofa", bofa_live, prev, backup, updated_at)
    if extract_value(doc["bofa"]) is None and manual_env_float("BOFA_MANUAL") is None:
        # 기본 서버와 동일한 기본값 (환경 미설정 시에만 의미 있음; merge가 이미 prev 채움)
        pass
    if doc["bofa"].get("fallbackUsed"):
        any_fallback = True

    doc["gsBullBear"] = merge_slot("gsBullBear", gs_live, prev, backup, updated_at)
    if doc["gsBullBear"].get("fallbackUsed"):
        any_fallback = True

    # 최초 저장소 비어 있을 때만 서버와 동일한 BofA 기본·GS 중립 시드 (정상 숫자 확보)
    if extract_value(doc.get("bofa")) is None:
        bv = manual_env_float("BOFA_MANUAL")
        if bv is None:
            bv = 2.1
        doc["bofa"] = slot_live(
            round(float(bv), 2),
            datetime.now(US_ET).date().isoformat(),
            updated_at,
            source_status="manual" if manual_env_float("BOFA_MANUAL") is not None else "seed",
            fallback_used=True,
        )
        any_fallback = True
    if extract_value(doc.get("gsBullBear")) is None:
        gv = manual_env_float("GS_BULLBEAR_MANUAL")
        if gv is None:
            gv = 50.0
        doc["gsBullBear"] = slot_live(
            round(float(gv), 2),
            datetime.now(US_ET).date().isoformat(),
            updated_at,
            source_status="manual" if manual_env_float("GS_BULLBEAR_MANUAL") is not None else "seed",
            fallback_used=True,
        )
        any_fallback = True

    doc["isStale"] = bool(any_fallback)

    for k in ("bofa", "gsBullBear"):
        slot = doc.get(k)
        if isinstance(slot, dict) and extract_value(slot) is not None:
            slot.setdefault("lastUpdated", slot.get("dataDate") or datetime.now(KST).strftime("%Y-%m-%d"))

    if not validate_payload(doc):
        log("Validation failed - refusing to write data.json (previous site data unchanged)")
        return 1

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    try:
        if OUT_JSON.exists():
            import shutil

            shutil.copy2(OUT_JSON, BACKUP_JSON)
    except OSError as e:
        log(f"backup copy warning: {e}")

    with OUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    log(f"Wrote {OUT_JSON}")
    print_session_verify_block(doc)
    return 0


def main() -> int:
    try:
        return run_once()
    except Exception:
        log(traceback.format_exc())
        return 1


if __name__ == "__main__":
    sys.exit(main())
