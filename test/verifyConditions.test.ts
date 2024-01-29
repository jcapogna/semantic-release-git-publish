// noinspection ES6PreferShortImport
import {verifyConditions} from "../src/verifyConditions.js";
import {afterEach, beforeEach, describe, expect, it, vi,} from "vitest";
import {Context, PluginContext} from "../src/types/semantic-release.js";
import {createMockContext} from "./helpers/mockContext.js";
import {Signale} from "signale";

const THIS_REPO_URL = "git@fakegit.com:thisrepo.git"
const VALID_DEST_REPO_URL = "git@fakegit.com:destination.git"
const INVALID_DEST_REPO_URL = "git@fakegit.com:invalid_destination.git"

const mockSimpleGit = vi.hoisted(() => {
    return {
        listRemote: vi.fn().mockImplementation((args: string[]) => {
            // simulate error listing invalid repo
            if (args[0] === INVALID_DEST_REPO_URL) {
                throw new Error()
            }
            return ""
        })
    }
})

vi.mock("simple-git", () => {
    return {
        simpleGit: vi.fn().mockReturnValue(mockSimpleGit)
    }
})

vi.mock("signale", () => {
    const Signale = vi.fn();
    Signale.prototype.info = vi.fn()
    Signale.prototype.debug = vi.fn()
    Signale.prototype.error = vi.fn()
    Signale.prototype.warn = vi.fn()
    return {Signale}
})

let mockLogger = new Signale()
beforeEach(() => {
    mockLogger = new Signale()
})

afterEach(() => {
    vi.clearAllMocks()
})

describe("verifyConditions", () => {
    it ("succeeds when all options are valid", async () => {
        const context: Context = createMockContext(mockLogger)
        const pluginContext: PluginContext = {
            repositoryUrl: THIS_REPO_URL,
            destinationRepositoryUrl: VALID_DEST_REPO_URL
        }
        await expect(
            verifyConditions(pluginContext, context)
        ).resolves.not.toThrowError()
    })

    it ("fails when no destinationRepositoryUrl is unset", async () => {
        const context: Context = createMockContext(mockLogger)
        const pluginContext: PluginContext = {
            repositoryUrl: THIS_REPO_URL,
            destinationRepositoryUrl: null
        }
        await expect(
            verifyConditions(pluginContext, context)
        ).rejects.toThrowError("Plugin configuration missing 'destinationRepositoryUrl'")
    })

    it ("fails when no destinationRepositoryUrl is same as this repository", async () => {
        const context: Context = createMockContext(mockLogger)
        const pluginContext: PluginContext = {
            repositoryUrl: THIS_REPO_URL,
            destinationRepositoryUrl: THIS_REPO_URL
        }
        await expect(
            verifyConditions(pluginContext, context)
        ).rejects.toThrowError("The source and destination repository are the same. You must publish to another repository")
    })

    it ("fails when no destinationRepositoryUrl cannot be read", async () => {
        const context: Context = createMockContext(mockLogger)
        const pluginContext: PluginContext = {
            repositoryUrl: THIS_REPO_URL,
            destinationRepositoryUrl: INVALID_DEST_REPO_URL
        }
        await expect(
            verifyConditions(pluginContext, context)
        ).rejects.toThrowError(`Unable to connect to destination repository at ${INVALID_DEST_REPO_URL}`)
    })

})