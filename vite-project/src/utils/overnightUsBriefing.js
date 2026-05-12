/**
 * 전일 미국시장 브리핑 — Yahoo 시세 기반, 문단형 데일리 메모 (LLM 미사용).
 */

/**
 * @param {{
 *   parsedData?: Record<string, number | null>
 *   changeData?: Record<string, number | null>
 *   updatedAt?: string | null
 * }} input
 * @returns {{ paragraphs: string[]; updatedAt: string | null }}
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

  const paragraphs = []

  // —— 문단 1: 미국 지수 흐름 (2문장 이내)
  if (Number.isFinite(nas) && Number.isFinite(sp)) {
    if (nas > 0.1 && sp > 0.1) {
      paragraphs.push(
        "미 증시는 기술주 중심 매수세가 이어지며 나스닥과 S&P500이 동반 상승으로 마감했다. 단기적으로 risk-on 기조가 유지된 마감이다.",
      )
    } else if (nas < -0.1 && sp < -0.1) {
      paragraphs.push(
        "미 증시는 나스닥·S&P500이 함께 내려 동조 약세로 하루를 마쳤다. 위험자산 축소 쪽 시선이 우세한 흐름이다.",
      )
    } else if (nas > sp + 0.15) {
      paragraphs.push(
        "미 증시는 나스닥이 S&P500보다 강한 상대 강도를 보였고, 지수 간 격차는 기술주 쪽으로 기울어진 마감이었다.",
      )
    } else if (nas < sp - 0.15) {
      paragraphs.push(
        "나스닥은 S&P500 대비 다소 약했고, 광범위 지수가 일간 흐름을 주도한 형태로 정리됐다.",
      )
    } else {
      paragraphs.push(
        "미 증시는 나스닥과 S&P500이 소폭 등락에 그쳐 방향성이 뚜렷하지 않은 하루였다.",
      )
    }
  } else {
    paragraphs.push("미국 주요 지수 시세를 불러오지 못했다. 피드 연동을 확인한 뒤 다시 읽는 것이 좋다.")
  }

  // —— 문단 2: 금리 · 변동성 · 환율 (한 덩어리로 연결)
  const hasMacro =
    Number.isFinite(tnxChg) || Number.isFinite(vix) || Number.isFinite(dxyChg) || Number.isFinite(krwChg)

  if (hasMacro) {
    let lead = ""
    if (Number.isFinite(tnxChg) && Number.isFinite(vix)) {
      const rate =
        Math.abs(tnxChg) < 0.35
          ? "장기금리는 제한적인 흐름을 유지했고"
          : tnxChg > 0
            ? "장기금리는 상방 압력이 감지됐고"
            : "장기금리는 완화 쪽으로 움직였고"
      let vol = ""
      if (vix < 15.5) vol = "변동성 지표 역시 낮은 구간에서 큰 변화 없이 마감했다."
      else if (vix < 21.5) {
        vol = "변동성 지표는 중립 구간에서 안정적인 모습을 이어갔다."
        if (Number.isFinite(vixChg) && Math.abs(vixChg) >= 4) {
          vol = "변동성 지표는 중립 구간에 머물렀으나 전일 변동폭은 두드러졌다."
        }
      } else if (vix < 28) {
        vol = "VIX는 상방에 붙어 있어 단기 변동성 부담을 완전히 걷어내긴 어렵다."
      } else {
        vol = "VIX는 높은 수준을 유지해 포지션 크기 점검이 필요한 환경이다."
      }
      lead = `${rate} ${vol}`
    } else if (Number.isFinite(vix)) {
      if (vix < 15.5) lead = "변동성 지표는 낮은 구간에서 안정적으로 마감했다."
      else if (vix < 21.5) lead = "VIX는 중립 구간에서 무난한 흐름이었다."
      else if (vix < 28) lead = "VIX는 상방 구간에 가깝게 붙어 있다."
      else lead = "VIX는 높은 레벨이다."
      if (Number.isFinite(vixChg) && Math.abs(vixChg) >= 4) {
        lead = lead.replace(/\.$/, "으며 전일 변화폭은 컸다.")
      }
    } else if (Number.isFinite(tnxChg)) {
      lead =
        Math.abs(tnxChg) < 0.35
          ? "장기금리는 좁은 범위에서 마감했다."
          : tnxChg > 0
            ? "장기금리는 상방으로 밀린 마감이었다."
            : "장기금리는 완화 쪽으로 정리됐다."
    }

    let fx = ""
    if (Number.isFinite(dxyChg)) {
      if (Math.abs(dxyChg) < 0.12) fx = "달러 인덱스는 보합권에 머물렀다."
      else if (dxyChg > 0) fx = "달러 인덱스는 강보합 이상의 상승으로 마감했다."
      else fx = "달러 인덱스는 하락 조정이었다."
    } else if (Number.isFinite(krwChg)) {
      if (Math.abs(krwChg) < 0.1) fx = "원·달러는 좁은 범위에서 마감했다."
      else if (krwChg > 0) fx = "원·달러는 원화 약세로 정리됐다."
      else fx = "원·달러는 원화 강세 쪽으로 움직였다."
    }

    if (lead && fx) {
      paragraphs.push(`${lead} ${fx}`)
    } else if (lead) {
      paragraphs.push(lead)
    } else if (fx) {
      paragraphs.push(fx)
    }
  } else {
    paragraphs.push("금리·변동성·환율 데이터를 모두 가져오지 못해 거시 맥락은 이번 브리핑에서 생략한다.")
  }

  // —— 문단 3: 섹터
  if (Number.isFinite(soxxChg) && Number.isFinite(spChg)) {
    const rel = soxxChg - spChg
    if (rel > 0.25) {
      paragraphs.push(
        "반도체 ETF(SOXX) 상대 강세가 이어지며 시장 주도 흐름이 테마 쪽에 붙어 있는 분위기다.",
      )
    } else if (rel < -0.25) {
      paragraphs.push(
        "반도체 구간은 광범위 지수 대비 열위였고, 섹터 내에서는 재고림이 감지되는 마감이다.",
      )
    } else {
      paragraphs.push(
        "반도체와 S&P500의 일간 격차는 크지 않아 섹터 간 밸런스가 크게 깨지지는 않았다.",
      )
    }
  } else if (Number.isFinite(soxxChg)) {
    paragraphs.push(
      soxxChg > 0.12
        ? "반도체 ETF는 상승 마감이었으나 지수 대비 해석은 데이터 제약이 있다."
        : soxxChg < -0.12
          ? "반도체 ETF는 하락 마감이었다."
          : "반도체 ETF는 보합권에서 마감했다.",
    )
  } else {
    paragraphs.push("SOXX 시세를 불러오지 못해 섹터 강약은 이번 호에서 생략한다.")
  }

  // —— 문단 4: 오늘 (문장으로만, 불릿 없음)
  const watch = []
  if (Number.isFinite(vix) && vix >= 22) {
    watch.push("변동성이 중립을 넘어선 구간에서는 추격보다 비중·진입 타이밍을 보수적으로 가져간다")
  }
  if (Number.isFinite(tnxChg) && tnxChg > 0.35) {
    watch.push("금리 상방이 이어지면 성장주 밸류에이션은 할인받을 여지가 있다")
  }
  if (Number.isFinite(nas) && nas > 0.35) {
    watch.push("기술주 단기 과열이 쌓이면 분할·확인 매수만 유지한다")
  }

  if (watch.length === 0) {
    paragraphs.push(
      "당일은 캘린더와 선물·환율 시그널을 먼저 보고, 국내장은 전일 미국 마감과 아시아 선물을 같은 축에서 스케치하는 편이 낫다.",
    )
  } else if (watch.length === 1) {
    paragraphs.push(
      `${watch[0]}. 이후 전일 마감과 당일 선물·환율을 연이어 확인한다.`,
    )
  } else {
    paragraphs.push(
      `${watch[0]}, ${watch[1]}. 세부 체결과 환율까지 묶어서 본다.`,
    )
  }

  return {
    paragraphs: paragraphs.slice(0, 4),
    updatedAt: input.updatedAt ?? null,
  }
}
