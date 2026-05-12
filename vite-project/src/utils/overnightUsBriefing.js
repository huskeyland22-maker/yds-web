/**
 * 전일 미국시장 브리핑 — Yahoo 기반 시세(changeData)로 규칙 기반 문장 생성.
 * (LLM 미사용, 기관 메모 톤의 짧은 확신형 문장)
 */

/**
 * @param {{
 *   parsedData?: Record<string, number | null>
 *   changeData?: Record<string, number | null>
 *   updatedAt?: string | null
 * }} input
 */
export function buildOvernightUsBriefing(input) {
  const p = input?.parsedData ?? {}
  const c = input?.changeData ?? {}

  const nas = c.nasdaq
  const sp = c.sp500
  const vix = p.vix
  const vixChg = c.vix
  const tnxChg = c.us10y
  const krwChg = c.usdkrw
  const dxyChg = c.dxy
  const soxxChg = c.soxx
  const spChg = c.sp500

  let usMarket = ""
  if (Number.isFinite(nas) && Number.isFinite(sp)) {
    if (nas > 0.1 && sp > 0.1) {
      usMarket = "미 증시는 나스닥·S&P500이 동반 상승으로 마감했다. 단기 risk-on 기조가 유지된 흐름이다."
    } else if (nas < -0.1 && sp < -0.1) {
      usMarket = "미 증시는 주요 지수가 동반 하락으로 마감했다. 방어·비중 조절 관점이 우선이다."
    } else if (nas > sp + 0.15) {
      usMarket = "나스닥이 S&P500 대비 상대 강세였다. 기술주 쏠림이 하루 단위로 이어졌다."
    } else if (nas < sp - 0.15) {
      usMarket = "나스닥은 S&P500 대비 열위였다. 대형주 지수 중심으로 등락이 정리됐다."
    } else {
      usMarket = "미 증시는 나스닥·S&P500이 소폭 등락으로 마감했다. 방향성은 제한적이었다."
    }
  } else {
    usMarket = "미국 주요 지수 데이터를 확인하지 못했다. 시세 연동 후 재확인이 필요하다."
  }

  const rateFx = []
  if (Number.isFinite(tnxChg)) {
    if (tnxChg > 0.35) rateFx.push("10년물 금리는 전일 대비 상승 압력이 있었다.")
    else if (tnxChg < -0.35) rateFx.push("10년물 금리는 완화 쪽으로 움직였다.")
    else rateFx.push("10년물 금리 변동은 제한적이었다.")
  }
  if (Number.isFinite(vix)) {
    if (vix < 15.5) rateFx.push("VIX는 낮은 구간이다. 현물 변동성 프리미엄은 크지 않다.")
    else if (vix < 21.5) rateFx.push("VIX는 중립대에서 안정적이다.")
    else if (vix < 28) rateFx.push("VIX는 상방 구간이다. 단기 헤지 비용을 감안한다.")
    else rateFx.push("VIX는 높은 레벨이다. 포지션 크기와 이벤트 리스크를 점검한다.")
    if (Number.isFinite(vixChg) && Math.abs(vixChg) >= 4) {
      rateFx.push("VIX 전일 변화폭은 두드러졌다.")
    }
  }
  if (Number.isFinite(dxyChg)) {
    if (dxyChg > 0.15) rateFx.push("달러 인덱스는 상승 마감이다.")
    else if (dxyChg < -0.15) rateFx.push("달러 인덱스는 하락 조정이었다.")
    else rateFx.push("달러 인덱스는 보합권이다.")
  } else if (Number.isFinite(krwChg)) {
    if (krwChg > 0.12) rateFx.push("원·달러는 원화 약세로 마감했다.")
    else if (krwChg < -0.12) rateFx.push("원·달러는 원화 강세로 마감했다.")
    else rateFx.push("원·달러 변동은 제한적이었다.")
  }

  let ratesFxVol = rateFx.slice(0, 3).join(" ")
  if (!ratesFxVol) ratesFxVol = "금리·환율·변동성 일부 지표를 불러오지 못했다."

  let sector = ""
  if (Number.isFinite(soxxChg) && Number.isFinite(spChg)) {
    const rel = soxxChg - spChg
    if (rel > 0.25) {
      sector = "반도체 ETF(SOXX)는 S&P500 대비 상대 강세다. 테마 주도가 유지됐다."
    } else if (rel < -0.25) {
      sector = "반도체 ETF는 지수 대비 열위다. 섹터 내 재고림이 있다."
    } else {
      sector = "반도체와 광범위 지수의 일간 격차는 크지 않다."
    }
  } else if (Number.isFinite(soxxChg)) {
    sector =
      soxxChg > 0.12
        ? "반도체 ETF는 상승 마감이다."
        : soxxChg < -0.12
          ? "반도체 ETF는 하락 마감이다."
          : "반도체 ETF는 보합권 마감이다."
  } else {
    sector = "SOXX 기준 섹터 데이터를 확인하지 못했다."
  }

  const checkpoints = []
  if (Number.isFinite(vix) && vix >= 21) checkpoints.push("VIX가 중립 상단 이상이면 추격 매수 비중은 보수적으로 유지한다.")
  if (Number.isFinite(tnxChg) && tnxChg > 0.35) checkpoints.push("금리 상방이 이어지면 성장주 밸류에이션 할인 요인으로 작용할 수 있다.")
  if (Number.isFinite(nas) && nas > 0.35) checkpoints.push("기술주 강세가 과열되면 분할·확인 매수 원칙을 유지한다.")
  if (checkpoints.length < 2) checkpoints.push("당일 캘린더·선물·환율 시그널을 우선 반영한다.")
  if (checkpoints.length < 3) checkpoints.push("국내장에서는 전일 미국 마감과 아시아 선물 흐름을 동시에 본다.")

  const chips = []
  if (Number.isFinite(nas) && Number.isFinite(sp)) {
    if (nas > 0.08 && sp > 0.08) chips.push("NASDAQ·S&P 상승")
    else if (nas < -0.08 && sp < -0.08) chips.push("지수 동반 약세")
    else chips.push("지수 혼조")
  }
  if (Number.isFinite(vix)) {
    if (vix < 16) chips.push("VIX 낮음")
    else if (vix < 22) chips.push("VIX 중립")
    else chips.push("VIX 경계")
  }
  if (Number.isFinite(tnxChg)) {
    if (tnxChg > 0.25) chips.push("장기금리 상방")
    else if (tnxChg < -0.25) chips.push("장기금리 완화")
    else chips.push("금리 안정")
  }
  if (Number.isFinite(soxxChg) && Number.isFinite(spChg) && soxxChg > spChg + 0.2) chips.push("반도체 상대 강세")
  if (Number.isFinite(dxyChg) && dxyChg > 0.12) chips.push("달러 강세")
  if (Number.isFinite(dxyChg) && dxyChg < -0.12) chips.push("달러 약세")

  return {
    usMarket,
    ratesFxVol,
    sector,
    checkpoints: checkpoints.slice(0, 3),
    chips: [...new Set(chips)].slice(0, 8),
    updatedAt: input.updatedAt ?? null,
  }
}
