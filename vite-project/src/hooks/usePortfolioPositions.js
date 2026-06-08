import { useCallback, useEffect, useState } from "react"
import {
  createPositionId,
  loadPortfolioPositions,
  savePortfolioPositions,
} from "../content/ydsPortfolioPositionsStorage.js"

/** @typedef {import("../content/ydsPortfolioPositionsStorage.js").PortfolioPosition} PortfolioPosition */

export function usePortfolioPositions() {
  const [positions, setPositions] = useState(() => loadPortfolioPositions())

  useEffect(() => {
    savePortfolioPositions(positions)
  }, [positions])

  /** @param {Omit<PortfolioPosition, 'id' | 'createdAt' | 'updatedAt'>} input */
  const addPosition = useCallback((input) => {
    const now = Date.now()
    const position = {
      ...input,
      id: createPositionId(),
      createdAt: now,
      updatedAt: now,
    }
    setPositions((prev) => [position, ...prev])
    return position
  }, [])

  /**
   * @param {string} id
   * @param {Partial<PortfolioPosition>} updates
   */
  const updatePosition = useCallback((id, updates) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p,
      ),
    )
  }, [])

  /** @param {string} id */
  const removePosition = useCallback((id) => {
    setPositions((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { positions, addPosition, updatePosition, removePosition, setPositions }
}
