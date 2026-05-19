import { useCallback, useEffect, useRef, useState } from "react"

/**
 * 터치 핀치·휠로 차트 가시 구간 축소/확대 (인덱스 기반)
 * @param {number} dataLength
 * @param {{ defaultWindow?: number }} [opts]
 */
export function useChartPinchZoom(dataLength, opts = {}) {
  const defaultWindow = opts.defaultWindow ?? dataLength
  const [windowSize, setWindowSize] = useState(() =>
    Math.min(Math.max(defaultWindow, 8), dataLength || defaultWindow),
  )
  const [startIndex, setStartIndex] = useState(0)
  const pinchRef = useRef({ dist: 0, size: windowSize })

  useEffect(() => {
    const maxLen = Math.max(dataLength, 1)
    const size = Math.min(Math.max(defaultWindow, 8), maxLen)
    setWindowSize(size)
    setStartIndex(Math.max(0, maxLen - size))
  }, [dataLength, defaultWindow])

  const clampWindow = useCallback(
    (size) => Math.min(Math.max(Math.round(size), 6), Math.max(dataLength, 6)),
    [dataLength],
  )

  const applyWindow = useCallback(
    (size, anchorEnd = true) => {
      const w = clampWindow(size)
      setWindowSize(w)
      setStartIndex((prev) => {
        const end = anchorEnd ? dataLength : prev + w
        return Math.max(0, Math.min(end - w, dataLength - w))
      })
    },
    [clampWindow, dataLength],
  )

  const onWheel = useCallback(
    (e) => {
      // Ctrl/Cmd+휠만 차트 줌 — 일반 휠은 페이지 스크롤
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? 1.12 : 0.88
      applyWindow(windowSize * delta)
    },
    [applyWindow, windowSize],
  )

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchRef.current = { dist, size: windowSize }
    }
  }, [windowSize])

  const onTouchMove = useCallback(
    (e) => {
      // 2손가락 핀치만 처리 — 1손가락 세로 스와이프는 문서 스크롤
      if (e.touches.length !== 2) return
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const { dist: prevDist, size } = pinchRef.current
      if (prevDist > 0) {
        const ratio = dist / prevDist
        applyWindow(size / ratio)
      }
      pinchRef.current.dist = dist
    },
    [applyWindow],
  )

  const visibleSlice = useCallback(
    (data) => {
      if (!Array.isArray(data) || !data.length) return []
      const end = Math.min(startIndex + windowSize, data.length)
      const start = Math.max(0, Math.min(startIndex, data.length - 1))
      return data.slice(start, end)
    },
    [startIndex, windowSize],
  )

  const panBy = useCallback(
    (delta) => {
      setStartIndex((prev) => Math.max(0, Math.min(prev + delta, Math.max(0, dataLength - windowSize))))
    },
    [dataLength, windowSize],
  )

  const resetZoom = useCallback(() => {
    applyWindow(defaultWindow)
  }, [applyWindow, defaultWindow])

  return {
    windowSize,
    startIndex,
    visibleSlice,
    panBy,
    resetZoom,
    onWheel,
    onTouchStart,
    onTouchMove,
  }
}
