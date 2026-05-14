/**
 * 패닉·시그널 데이터를 원격 API에서 가져오고 주기적으로 동기화합니다.
 * false로 두면 PWA/웹이 로컬 스냅샷에 고립되어 기기 간 불일치가 발생합니다.
 */
export const AUTO_DATA_ENGINE_ENABLED = true

/** panicStore · SignalDashboard 공통 폴링 간격 (ms) */
export const PANIC_DATA_POLL_MS = 90_000
