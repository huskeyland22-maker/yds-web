import { useCallback, useEffect, useState } from "react"
import {
  loadPortfolioReview,
  savePortfolioReview,
} from "../content/ydsPortfolioReviewStorage.js"

/** @typedef {import("../content/ydsPortfolioReviewStorage.js").PortfolioReview} PortfolioReview */

export function usePortfolioReview() {
  const [review, setReview] = useState(() => loadPortfolioReview())

  useEffect(() => {
    savePortfolioReview(review)
  }, [review])

  /** @param {Partial<PortfolioReview>} patch */
  const updateReview = useCallback((patch) => {
    setReview((prev) => ({ ...prev, ...patch, updatedAt: Date.now() }))
  }, [])

  return { review, updateReview }
}
