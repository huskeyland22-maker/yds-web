/**
 * node --test scripts/panic-schema-errors.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isMissingPanicRelationError,
  toPreviewSchemaMissingError,
} from "../api/_lib/panicSchemaErrors.js"

describe("panic schema errors", () => {
  it("detects PGRST205 missing table messages", () => {
    assert.equal(
      isMissingPanicRelationError(
        new Error("Supabase 404: Could not find the table 'public.panic_index_history' in the schema cache"),
      ),
      true,
    )
  })

  it("maps to preview_schema_missing 503", () => {
    const err = toPreviewSchemaMissingError(new Error("Could not find the table"))
    assert.equal(err.code, "preview_schema_missing")
    assert.equal(err.statusCode, 503)
    assert.equal(err.stage, "pipeline")
    assert.equal(err.retryable, true)
    assert.match(String(err.hint || ""), /staging-panic-bootstrap/)
  })
})
