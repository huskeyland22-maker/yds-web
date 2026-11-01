# P2-24 통합 테스트 초안 (스테이징 / 로컬만)

**프로덕션 실행·데이터 변경 금지.**  
전제: `P2-24_01` → `P2-24_02` 순으로 **스테이징**에만 적용 후 검증.  
권한: `P2-24_03` VERIFY만 먼저 실행(읽기). HARDEN은 미적용·미확인 라이브 권한.

## 계약 요약 (P2-26 / P2-28)

| payload | UPDATE / INSERT 결과 |
|---------|----------------------|
| score/status 키 생략 | 기존 유지 / INSERT 시 score·status NULL |
| `panic_score_status=ok` + 유한 0~100 | 점수·`ok` 갱신 (50 허용) — **명시적 Official만** |
| `panic_score_status=data_insufficient` | 점수 NULL, status 저장 (동시 숫자 무시) |
| `ok` + null/비숫자/NaN/±Inf/범위밖 | **exception** |
| status 키 있음 + null/`""` (± score) | **exception** `panic_score_status_null_or_empty_not_allowed` |
| 앱이 status=`stored_unverified` 명시 | **exception** |
| 구버전: 숫자만 (status 키 없음), 유한 0~100 | 점수 갱신 + status **`stored_unverified`** (ok 유지/승격 금지) |
| 구버전: null/빈 점수만 (status 없음) | **clear 안 함** (점수·status 유지) |
| 구버전: NaN/±Inf/범위밖/비숫자 | **exception** (INSERT=UPDATE) |
| `long_score` / `recommendation` | **독립 coalesce** (panic clear와 비결합) |
| `short_score` / `mid_score` | 기존 coalesce 유지 |

**출처 분리:** 구버전은 점수 호환만 제공하고 Official(`ok`)을 증명하지 못함. Official은 명시적 `panic_score_status:"ok"` + 유효 점수만.

조회(앱): P2-20 — `stored_unverified` → `official_panic_score: null`.

## 케이스 — 기본 (T1–T10)

| ID | 시나리오 | 기대 |
|----|----------|------|
| T1 | 신규 date, `{panic_score:42, panic_score_status:"ok"}` | 42 / ok |
| T2 | 신규 date, Official **50** + ok | 50 / ok (결측과 구분) |
| T3 | 기존 행 48 + `stored_unverified` 백필 후, score/status **생략** | **48 유지** |
| T4 | 기존 48 + `{panic_score_status:"data_insufficient"}` | NULL + data_insufficient |
| T5 | T4 후 `sync_latest_panic_metrics(date)` | latest 점수 NULL + status 동기화, **서로 일치** |
| T6 | 백필만: 숫자 행 → stored_unverified, NULL 행 status NULL | 점수 값 불변 |
| T7 | 구 payload `{panic_score:40}` status 키 없음 | 40 저장 + status **`stored_unverified`** |
| T8 | 구 payload `{panic_score:null}` status 없음 | 기존 점수 **유지** |
| T9 | `{panic_score_status:"ok"}` only | exception `ok_requires_finite_panic_score` |
| T10 | market_cycle: short/mid coalesce 기존과 동일 | short/mid 미파괴 |

## 케이스 — P2-26 회귀 (T11–T24)

| ID | 시나리오 | 기대 |
|----|----------|------|
| T11 | `{panic_score:40, panic_score_status:null}` | exception `panic_score_status_null_or_empty_not_allowed` |
| T12 | `{panic_score:40, panic_score_status:""}` | 동일 exception |
| T13 | `{panic_score_status:"stored_unverified"}` (± score) | exception `stored_unverified_not_allowed_on_write` |
| T14 | ok + `NaN` / `"Infinity"` / `"-Infinity"` | exception `ok_requires_finite_panic_score` |
| T15 | ok + `-1` / `101` | exception `ok_score_out_of_range` |
| T16 | ok + 비숫자 문자열 / bool / object | exception (finite 요구) |
| T17 | **신규 INSERT**와 **기존 UPDATE**에 T14–T16 동일 적용 | 양쪽 모두 거부, 행 미오염 |
| T18 | 구버전 `{panic_score:"NaN"}` 등 (status 생략) INSERT+UPDATE | exception `legacy_panic_score_invalid` / `_out_of_range` |
| T19 | `{panic_score_status:"data_insufficient", panic_score:77}` | 점수 NULL, status `data_insufficient` (77 무시) |
| T20 | market_cycle: 기존 long=55, payload `{panic_score:40}` only | panic 40, **long 55 유지** |
| T21 | market_cycle: 기존 recommendation=`"hold"`, `data_insufficient` | panic NULL, **recommendation `"hold"` 유지** |
| T22 | `P2-24_03` VERIFY: anon/authenticated/PUBLIC EXECUTE | **라이브 결과 기록** (현재 미확인). 기대 정책: 없음 / service_role만 |
| T23 | T4/T5와 별도: history clear 후 sync → latest.score **와** latest.status가 history와 **완전 일치** | |
| T24 | **daily_ai_reports**: T1,T2,T3,T4,T7,T8,T11,T13,T19 동등 | history와 동일 계약 |

## 케이스 — P2-28 정합 (T25–T30)

| ID | 시나리오 | 기대 |
|----|----------|------|
| T25 | 행이 `data_insufficient`/NULL 점수 → 구버전 `{panic_score:40}` | **40 + `stored_unverified`** (insufficient 잔존 금지) |
| T26 | 행이 `ok`/50 → 구버전 `{panic_score:40}` | **40 + `stored_unverified`** (`ok` 유지 금지) |
| T27 | 명시 `{panic_score:40, panic_score_status:"ok"}` | **40 / `ok`** (Official) |
| T28 | score·status 키 **모두 생략** | 기존 점수·status **유지** |
| T29 | 명시 `{panic_score_status:"data_insufficient"}` | 점수 NULL + `data_insufficient` |
| T30 | T25 또는 T29 후 `sync_latest_panic_metrics(date)` | latest.score·status가 history와 **일치** (모순 없음) |

## 검증 방법

1. 스테이징 DB 스냅샷/시드  
2. `01` 적용 → `\d+` 컬럼·CHECK 확인 → 백필 count  
3. `02` 적용 → `prosrc`에 helper·intent 분기 존재 확인  
4. T1–T30을 `service_role`로 `select upsert_*(...)` 실행  
5. T22: `P2-24_03` VERIFY SELECT만 (HARDEN 주석 유지)  
6. 롤백 스모크: 구 RPC SQL로 REPLACE 후 T3/T8 coalesce 복구 (컬럼은 유지)

## 문서화 — recommendation / long_score (P2-26)

- **이전 초안(P2-24 초기)** 은 `data_insufficient` 시 `recommendation` NULL, `intent.apply` 시 `long_score:=panic` 을 제안했으나, 이는 baseline `20250519150000_*` 독립 coalesce와 충돌(P2-25 P1).
- **현재 초안** 은 baseline을 우선: `long_score`·`recommendation`은 payload 키 기준 독립 coalesce. Official panic clear와 **자동 결합하지 않음**.
- 향후 Official long 결합이 필요하면 **별도 명시 계약 + 테스트** 후 변경.

## JS 후속 (초안 범위 밖, 배포 전 필요)

- `buildMarketCyclePayload` / daily upsert: `panic_score_status` 전송  
- history: 지표 null-omit 유지, 결측 시 **status 키 필수**로 clear  
- status를 null/`""`로 보내지 말 것 (RPC 거부)  
- `dailyReportToClient`: DB status=`ok`일 때만 `official_panic_score` 채움 (선택 후속)
