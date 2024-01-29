import * as Index from "../src/index.js"

import { describe, expect, test } from "vitest"

describe("index", () => {
    test("publish is a function", () => {
        expect(Index.publish).toBeInstanceOf(Function)
    })
    test("verifyConditions is a function", () => {
        expect(Index.verifyConditions).toBeInstanceOf(Function)
    })
})