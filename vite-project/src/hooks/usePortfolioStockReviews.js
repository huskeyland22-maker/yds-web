import { useCallback, useEffect, useState } from "react"
import {
  loadPortfolioStockReviews,
  savePortfolioStockReviews,
} from "../content/ydsPortfolioStockReviewStorage.js"

/** @typedef {import("../content/ydsPortfolioStockReviewStorage.js").PortfolioStockReview} PortfolioStockReview */

const EMPTY = {
  buyReason: "",
  lessons: "",
  nextAction: "",
  updatedAt: 0,
}

export function usePortfolioStockReviews() {
  const [reviews, setReviews] = useState(() => loadPortfolioStockReviews())

  useEffect(() => {
    savePortfolioStockReviews(reviews)
  }, [reviews])

  /** @param {string} positionId */
  const getReview = useCallback(
    (positionId) => reviews[positionId] ?? EMPTY,
    [reviews],
  )

  /**
   * @param {string} positionId
   * @param {Partial<PortfolioStockReview>} patch
   */
  const updateReview = useCallback((positionId, patch) => {
    if (!positionId) return
    setReviews((prev) => ({
      ...prev,
      [positionId]: {
        ...(prev[positionId] ?? EMPTY),
        ...patch,
        updatedAt: Date.now(),
      },
    }))
  }, [])

  return { getReview, updateReview }
}
