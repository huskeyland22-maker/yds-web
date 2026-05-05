/**
 * STEP 8: 시계열 API 연결 전 더미 차트 데이터 (동일 시점에 5지표 값).
 * 백엔드 시계열 연동 후 이 배열을 API 응답으로 교체하면 됨.
 */
export const PANIC_DUMMY_CHART_ROWS = [
  { time: "1", vix: 18, putCall: 0.88, bofa: 2.0, fearGreed: 45, highYield: 3.9 },
  { time: "2", vix: 20, putCall: 0.92, bofa: 2.3, fearGreed: 38, highYield: 4.0 },
  { time: "3", vix: 17, putCall: 0.85, bofa: 2.1, fearGreed: 52, highYield: 3.7 },
  { time: "4", vix: 22, putCall: 0.98, bofa: 2.5, fearGreed: 33, highYield: 4.2 },
  { time: "5", vix: 19, putCall: 0.9, bofa: 2.2, fearGreed: 48, highYield: 4.05 },
]
