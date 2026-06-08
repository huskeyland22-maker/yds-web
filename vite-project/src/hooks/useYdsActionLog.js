import { useCallback, useEffect, useState } from "react"
import { buildActionLogEntry, updateActionLogEntry } from "../content/ydsActionLogEngine.js"
import {
  deleteActionLogById,
  loadActionLogs,
  saveActionLogs,
  upsertActionLog,
} from "../content/ydsActionLogStorage.js"

/** @typedef {import("../content/ydsActionLogStorage.js").YdsActionLogEntry} YdsActionLogEntry */
/** @typedef {import("../content/ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */

export function useYdsActionLog() {
  const [entries, setEntries] = useState(() => loadActionLogs())

  useEffect(() => {
    saveActionLogs(entries)
  }, [entries])

  /** @param {import("../content/ydsActionLogEngine.js").ActionLogInput} input @param {YdsMarketAdapterContext} context */
  const addEntry = useCallback((input, context) => {
    const entry = buildActionLogEntry(context, input)
    setEntries((prev) => upsertActionLog(entry, prev))
    return entry
  }, [])

  /**
   * @param {string} id
   * @param {import("../content/ydsActionLogEngine.js").ActionLogInput} input
   * @param {YdsMarketAdapterContext} context
   */
  const updateEntry = useCallback((id, input, context) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.id === id)
      if (!existing) return prev
      const updated = updateActionLogEntry(existing, context, input)
      return upsertActionLog(updated, prev)
    })
  }, [])

  /** @param {string} id */
  const removeEntry = useCallback((id) => {
    setEntries((prev) => deleteActionLogById(id, prev))
  }, [])

  return { entries, addEntry, updateEntry, removeEntry }
}
