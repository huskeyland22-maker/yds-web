import { getStatus } from "../utils/panicIndicatorStatus.js"
import { motion } from "framer-motion"
import { panicMetricFooterLines, panicMetricNumber } from "../utils/panicMetricValue.js"

const cardStyle = {
  background: "#1f2937",
  padding: "16px",
  borderRadius: "14px",
  textAlign: "left",
  color: "white",
  boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
  transition: "all 0.2s ease",
  height: "auto",
  minHeight: "unset",
  overflow: "visible",
}

const statusColorMap = {
  neutral: { bg: "#374151", text: "#e5e7eb" },
  safe: { bg: "#166534", text: "#dcfce7" },
  warning: { bg: "#b45309", text: "#fef3c7" },
  danger: { bg: "#991b1b", text: "#fee2e2" },
}

const copyByType = {
  vix: {
    desc: "단기 변동성 안정 구간을 확인하는 핵심 지표입니다.",
    usage: ["급등 시 분할매수 검토", "옵션 과매도 구간 체크"],
    interp: "시장 공포 심리가 낮은 상태입니다.",
  },
  vxn: {
    desc: "나스닥 중심 기술주 공포 심리를 측정하는 변동성 지표입니다.",
    usage: ["AI/반도체 변동성 급등 구간 체크", "기술주 단기 과열/공포 판단"],
    interp: "성장주 리스크 온도 확인에 유용합니다.",
  },
  putCall: {
    desc: "옵션 수급의 과열/과매도 쏠림을 보여줍니다.",
    usage: ["1.0 이상 시 과매도 가능성 확인", "0.7 이하 시 과열 경계"],
    interp: "단기 수급 편향을 점검할 수 있습니다.",
  },
  move: {
    desc: "채권시장 변동성(MOVE)으로 금리시장 위험을 선행 감지합니다.",
    usage: ["급등 시 방어 비중 강화", "금리 민감 섹터 리스크 점검"],
    interp: "거시 변동성 리스크를 빠르게 반영합니다.",
  },
  fearGreed: {
    desc: "시장 심리 온도를 중기 관점에서 측정합니다.",
    usage: ["탐욕 구간에서 익절 준비", "공포 구간에서 분할 접근"],
    interp: "투자자 심리 과열/위축 수준을 보여줍니다.",
  },
  bofa: {
    desc: "기관 관점 위험 선호도를 확인하는 중기 지표입니다.",
    usage: ["극단값에서 비중 조절", "중립 구간에서 추세 확인"],
    interp: "리스크 선호 흐름을 파악할 수 있습니다.",
  },
  skew: {
    desc: "꼬리위험(블랙스완) 가격을 반영하는 장기 리스크 지표입니다.",
    usage: ["140+ 구간 리스크 경계", "급등 시 헷지/현금 비중 점검"],
    interp: "시장 하방 충격 우려를 보여줍니다.",
  },
  highYield: {
    desc: "신용시장 위험 신호를 장기 관점에서 추적합니다.",
    usage: ["스프레드 확대 시 방어 강화", "축소 시 위험자산 복원 검토"],
    interp: "거시 리스크 확대 여부를 확인합니다.",
  },
  gsBullBear: {
    desc: "기관 장기 심리 사이클을 보여주는 Bull/Bear 지표입니다.",
    usage: ["극단 낙관/비관에서 비중 조절", "장기 추세 전환 신호 보조"],
    interp: "중장기 리스크 선호 사이클을 확인합니다.",
  },
}

function rawMetric(panicData, metricKey) {
  if (!panicData || typeof panicData !== "object") return null
  if (metricKey === "gsBullBear") {
    return panicData.gsBullBear ?? panicData.gs ?? null
  }
  return panicData[metricKey] ?? null
}

function formatDisplay(type, num) {
  if (type === "putCall") return num.toFixed(2)
  if (type === "fearGreed" || type === "gsBullBear") return String(Math.round(num))
  const rounded = Math.round(num * 100) / 100
  return String(rounded)
}

/**
 * @param {{ title: string; metricKey: string; panicData?: object; type?: string }} props
 */
export default function PanicMetricCard({ title, metricKey, panicData, type }) {
  const raw = rawMetric(panicData, metricKey)
  const num = panicMetricNumber(raw)
  const status = getStatus(type, Number.isFinite(num) ? num : null)
  const statusStyle = statusColorMap[status.className] ?? statusColorMap.neutral
  const display = Number.isFinite(num) ? formatDisplay(type ?? "", num) : "-"
  const copy = copyByType[type] ?? {
    desc: "지표의 흐름을 확인해 리스크를 점검하세요.",
    usage: ["수치 급변 시 경계", "추세 확인 후 비중 조절"],
    interp: "현재 시장 흐름을 보조적으로 해석합니다.",
  }

  const footerLines = panicMetricFooterLines(raw)
  const meta = raw && typeof raw === "object" && "value" in raw ? raw : null
  const bofaStyleNote =
    type === "bofa" && meta?.fallbackUsed
      ? " (latest available 데이터 유지 중)"
      : type === "gsBullBear" && meta?.fallbackUsed
        ? " (latest available 데이터 유지 중)"
        : null

  return (
    <motion.div
      style={cardStyle}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ scale: 1.05, y: -6, boxShadow: "0 15px 40px rgba(0,0,0,0.6)" }}
      whileTap={{ scale: 0.95 }}
    >
      <h3 className="m-0 text-xs font-semibold text-gray-400 sm:text-sm">{title}</h3>

      <p
        className="mb-1 mt-2 font-mono text-lg font-bold sm:text-xl"
        style={{ fontSize: "20px", fontWeight: "bold", color: statusStyle.text }}
      >
        {display}
        {bofaStyleNote ? <span className="block text-[11px] font-normal text-gray-500">{bofaStyleNote}</span> : null}
      </p>

      <span
        style={{
          padding: "4px 8px",
          borderRadius: "8px",
          fontSize: "12px",
          background: statusStyle.bg,
          color: statusStyle.text,
        }}
      >
        {status.label}
      </span>
      <p className="mt-3 text-xs text-gray-300" style={{ lineHeight: 1.7, letterSpacing: "-0.02em", opacity: 0.92 }}>
        {copy.desc}
      </p>
      <div className="mt-2 text-xs text-gray-300" style={{ lineHeight: 1.7, letterSpacing: "-0.02em", opacity: 0.92 }}>
        <p className="m-0 font-semibold text-gray-200">활용 전략</p>
        <ul className="m-0 mt-1 list-disc pl-4">
          {copy.usage.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-xs text-gray-300" style={{ lineHeight: 1.7, letterSpacing: "-0.02em", opacity: 0.92 }}>
        현재 해석: {copy.interp}
      </p>
      {footerLines.length ? (
        <div className="mt-2 space-y-0.5 border-t border-white/5 pt-2">
          {footerLines.map((line) => (
            <p key={line} className="m-0 text-[11px] text-gray-400">
              {line}
            </p>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-[11px] text-cyan-300/70">시장 심리 기반 지표</p>
    </motion.div>
  )
}
