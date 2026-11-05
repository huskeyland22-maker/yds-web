/**
 * node --test src/utils/errorMessage.test.js
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatSaveErrorForUi } from "./errorMessage.js"

describe("formatSaveErrorForUi", () => {
  it("never includes JS stack frames for users", () => {
    const err = new Error("Preview Staging DB에 panic 테이블이 없습니다.")
    err.status = 503
    err.stage = "pipeline"
    err.code = "preview_schema_missing"
    err.stack = "Error: boom\n    at index-BlA7G3UJ.js:1:1\n    at submitInput (App.jsx:800:1)"
    const text = formatSaveErrorForUi(err, "fallback")
    assert.match(text, /클라우드 저장에 실패/)
    assert.match(text, /status: 503/)
    assert.match(text, /stage: pipeline/)
    assert.doesNotMatch(text, /index-.*\.js/)
    assert.doesNotMatch(text, /at submitInput/)
  })

  it("keeps incomplete metrics guidance without stacks", () => {
    const err = new Error("incomplete")
    err.code = "INCOMPLETE_CORE_METRICS"
    err.missing = ["vix"]
    err.stack = "Error: x\n    at foo.js:1:1"
    const text = formatSaveErrorForUi(err)
    assert.match(text, /누락된 핵심 지표: vix/)
    assert.doesNotMatch(text, /foo\.js/)
  })

  it("shows grant guidance for preview_table_permission_denied", () => {
    const err = new Error("Staging panic 테이블 권한이 없습니다.")
    err.status = 503
    err.stage = "pipeline"
    err.code = "preview_table_permission_denied"
    err.stack = "Error: boom\n    at index-xyz.js:1:1"
    const text = formatSaveErrorForUi(err)
    assert.match(text, /GRANT/)
    assert.match(text, /staging-panic-grants/)
    assert.doesNotMatch(text, /index-xyz\.js/)
  })
})
