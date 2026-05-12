/**
 * Overnight market recap — Seeking Alpha식 밀도·흐름 (Korean), Yahoo market-data 기반. LLM 미사용.
 */

/**
 * @param {{
 *   parsedData?: Record<string, number | null>
 *   changeData?: Record<string, number | null>
 *   updatedAt?: string | null
 * }} input
 * @returns {{ prose: string; updatedAt: string | null }}
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
  const putCall = p.putCall
  const move = p.move

  /** @type {string[]} */
  const s = []

  if (Number.isFinite(nas) && Number.isFinite(sp)) {
    if (nas > 0.12 && sp > 0.12) {
      s.push(
        "지난밤 미국 증시는 기술주 중심 매수세가 이어지며 나스닥이 상대 강세를 유지했고, S&P500 역시 상승 마감으로 흐름을 맞췄다.",
      )
    } else if (nas < -0.12 && sp < -0.12) {
      s.push(
        "지난밤 미국 증시는 나스닥·S&P500이 함께 내려 위험자산 비중을 줄이는 쪽 시선이 상대적으로 강한 밤이었다.",
      )
    } else if (nas > sp + 0.18) {
      s.push(
        "지난밤 미국 증시는 나스닥이 S&P500보다 강했고, 기술주 쏠림이 하루 단위로도 이어진 마감이었다.",
      )
    } else if (nas < sp - 0.18) {
      s.push(
        "지난밤 미국 증시는 나스닥이 S&P500 대비 다소 약했고, 광범위 지수가 일간 흐름을 주도한 형태로 정리됐다.",
      )
    } else {
      s.push("지난밤 미국 증시는 나스닥과 S&P500이 소폭 등락에 그쳐 방향성이 뚜렷하지 않았다.")
    }
  } else {
    s.push("미국 주요 지수 시세를 불러오지 못해 지수 요약은 이번 호에서 생략한다.")
  }

  if (Number.isFinite(soxxChg) && Number.isFinite(spChg)) {
    const rel = soxxChg - spChg
    if (rel > 0.28) {
      s.push(
        "반도체 ETF(SOXX)는 광범위 지수를 웃돌며 마감했고, 시장 주도권이 테마 쪽에 붙어 있는 분위기가 유지됐다.",
      )
    } else if (rel < -0.28) {
      s.push(
        "반도체 구간은 지수 대비 열위였고, 기술주 내부에서도 재고림이 감지되는 흐름이었다.",
      )
    } else {
      s.push("반도체와 S&P500의 일간 격차는 크지 않아 섹터 간 온도 차는 크게 벌어지지 않았다.")
    }
  } else if (Number.isFinite(soxxChg)) {
    s.push(
      soxxChg > 0.15
        ? "반도체 ETF는 상승 마감이었으나 지수 대비 해석은 데이터가 제한적이다."
        : soxxChg < -0.15
          ? "반도체 ETF는 하락 마감이었다."
          : "반도체 ETF는 보합권에서 마감했다.",
    )
  }

  if (Number.isFinite(tnxChg) && Number.isFinite(vix)) {
    const rateLead =
      Math.abs(tnxChg) < 0.4
        ? "장기금리 움직임은 제한적이었고"
        : tnxChg > 0
          ? "장기금리는 소폭이지만 상방 압력이 있었고"
          : "장기금리는 완화 쪽으로 정리됐고"

    let volMid = ""
    if (vix < 16) volMid = "변동성 지표 역시 안정 구간 흐름을 이어갔다."
    else if (vix < 22) {
      volMid =
        Number.isFinite(vixChg) && Math.abs(vixChg) >= 4
          ? "변동성 지표는 중립대에 머물렀으나 전일 변화폭은 눈에 띄었다."
          : "변동성 지표 역시 중립 구간에서 무난한 모습을 보였다."
    } else if (vix < 28) volMid = "VIX는 중립을 넘어선 쪽에 붙어 단기 변동성 부담을 완전히 걷어내긴 어렵다."
    else volMid = "VIX는 높은 수준을 유지해 위험자산 비중은 절제가 필요한 환경이다."

    let fxTail = ""
    if (Number.isFinite(dxyChg)) {
      if (Math.abs(dxyChg) < 0.12) fxTail = "달러 인덱스는 보합권에 머물렀다."
      else if (dxyChg > 0) fxTail = "달러 인덱스는 강보합 이상의 상승으로 마감했다."
      else fxTail = "달러 인덱스는 약세 조정이었다."
    } else if (Number.isFinite(krwChg)) {
      if (Math.abs(krwChg) < 0.1) fxTail = "원·달러는 좁은 범위에서 마감했다."
      else if (krwChg > 0) fxTail = "원·달러는 원화 약세로 정리됐다."
      else fxTail = "원·달러는 원화 강세 쪽으로 움직였다."
    }

    s.push(fxTail ? `${rateLead} ${volMid} ${fxTail}` : `${rateLead} ${volMid}`)
  } else if (Number.isFinite(vix)) {
    let t = ""
    if (vix < 16) t = "변동성 지표는 낮은 구간에서 안정적으로 마감했다."
    else if (vix < 22) t = "변동성 지표는 중립 구간 흐름을 이어갔다."
    else if (vix < 28) t = "VIX는 중립 상단에 가깝게 붙어 있다."
    else t = "VIX는 높은 레벨이다."
    if (Number.isFinite(vixChg) && Math.abs(vixChg) >= 4) {
      t = t.replace(/\.$/, "으며 전일 변동폭은 컸다.")
    }
    s.push(t)
  } else if (Number.isFinite(tnxChg)) {
    s.push(
      Math.abs(tnxChg) < 0.4
        ? "장기금리는 좁은 범위에서 마감했다."
        : tnxChg > 0
          ? "장기금리는 상방으로 밀린 마감이었다."
          : "장기금리는 완화 쪽으로 마감했다.",
    )
  } else if (Number.isFinite(dxyChg)) {
    s.push(
      Math.abs(dxyChg) < 0.12
        ? "달러 인덱스는 보합권이었다."
        : dxyChg > 0
          ? "달러 인덱스는 상승 마감이었다."
          : "달러 인덱스는 하락 조정이었다.",
    )
  } else if (Number.isFinite(krwChg)) {
    s.push(
      Math.abs(krwChg) < 0.1
        ? "원·달러는 좁은 범위에서 마감했다."
        : krwChg > 0
          ? "원·달러는 원화 약세로 마감했다."
          : "원·달러는 원화 강세로 마감했다.",
    )
  }

  if (Number.isFinite(putCall) && Number.isFinite(move)) {
    if (putCall >= 1.02 && move >= 98) {
      s.push(
        "옵션 풋/콜은 방어 쪽으로 기울어진 모습이었고, MOVE도 높게 유지되며 채권 변동성 감시가 겹친 밤이었다.",
      )
    } else if (putCall <= 0.85 && move <= 85) {
      s.push(
        "풋/콜은 낮았고 MOVE도 낮아 옵션·국채 쪽 스트레스 신호는 크지 않았다.",
      )
    } else if (putCall >= 1.02) {
      s.push("옵션 시장에서는 풋 우위가 엿보였고 헤지 수요가 일부 겹쳤다.")
    } else if (move >= 98) {
      s.push("채권 변동성 지표(MOVE)는 금리 스트레스를 염두에 둘 만한 수준이었다.")
    } else if (move <= 85) {
      s.push("MOVE는 낮게 유지돼 국채 변동성 스트레스는 제한적이었다.")
    }
  } else if (Number.isFinite(putCall)) {
    if (putCall >= 1.02) s.push("옵션 풋/콜은 방어 쪽으로 다소 기울어진 모습이었다.")
    else if (putCall <= 0.85) s.push("풋/콜은 낮아 과도한 헤지 쏠림은 아니었다.")
  } else if (Number.isFinite(move)) {
    if (move >= 98) s.push("MOVE는 금리 변동성 감시가 유효한 구간에 머물렀다.")
    else if (move <= 85) s.push("MOVE는 낮아 국채 쪽 스트레스는 크지 않았다.")
  }

  if (Number.isFinite(nas) && Number.isFinite(vix)) {
    if (nas > 0.28 && vix < 17) {
      s.push(
        "다만 장 막판에는 추격보다는 확인 매수 쪽 무게가 겹치며 단기 과열 경계 심리도 함께 나타나는 분위기였다.",
      )
    } else if (Number.isFinite(vixChg) && vixChg > 3.5) {
      s.push(
        "다만 변동성 쪽 민감도가 올라가며 일부 헤지 수요가 유입되는 모습이 겹쳤다.",
      )
    } else if (vix >= 22) {
      s.push(
        "리스크온에 무게를 두기엔 변동성 부담이 남아 있어 막판 흐름은 신중한 쪽으로 읽혔다.",
      )
    } else {
      s.push(
        "심리는 한쪽으로 과도하게 기울기보다는 실적·지표 확인에 무게를 둔 거래가 섞인 세션으로 보인다.",
      )
    }
  } else if (Number.isFinite(vix) && vix >= 22) {
    s.push("VIX가 높게 유지되는 만큼 막판에는 경계 심리가 남아 있는 밤이었다.")
  }

  s.push(
    "국내장은 미국 반도체 흐름과 함께 환율, 선물, 외국인 수급을 같은 축에서 체크할 필요가 있다.",
  )

  const prose = s.filter(Boolean).slice(0, 7).join(" ")

  return {
    prose,
    updatedAt: input.updatedAt ?? null,
  }
}
