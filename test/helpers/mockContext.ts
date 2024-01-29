import {Context} from "../../src/types/semantic-release.js";
import {Signale} from "signale";

export const mockCwd: string = "mock-current-dir"

export function createMockContext(logger: Signale): Context {
    return {
        cwd: mockCwd,
        env: {},
        stdout: new WritableStream(),
        stderr: new WritableStream(),
        options: {},
        nextRelease: {
            version: "1.0.0",
            gitTag: "v1.0.0",
            gitHead: "abcdef",
            notes: ""
        },
        logger: logger
    }
}