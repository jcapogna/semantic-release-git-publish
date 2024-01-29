// noinspection ES6PreferShortImport
import {publish} from "../src/publish.js";
import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";
import {Context, PluginContext} from "../src/types/semantic-release.js";
import {createMockContext, mockCwd} from "./helpers/mockContext.js";
import {syncFiles} from "../src/utils/syncFiles.js";
import {Signale} from "signale";

const THIS_REPO_URL = "git@fakegit.com:thisrepo.git"
const DEST_REPO_URL = "git@fakegit.com:destination.git"

let isCleanMockValue = vi.hoisted(() => false)
const mockSimpleGit= vi.hoisted(() => {
    return {
        clone: vi.fn().mockReturnThis(),
        cwd: vi.fn(),
        status: vi.fn().mockImplementation(() => {
            return {
                isClean: () => isCleanMockValue
            }
        }),
        commit: vi.fn(),
        addTag: vi.fn(),
        push: vi.fn(),
        pushTags: vi.fn(),
    }
})

vi.mock("simple-git", () => {
    return {
        simpleGit: vi.fn().mockReturnValue(mockSimpleGit)
    }
})

const mockTmpDirCleanup = vi.hoisted(() => vi.fn())
vi.mock("tmp-promise", () => {
    return {
        dir: vi.fn().mockImplementation(() => {
            return {
                path: "/tmp/fake-for-testing",
                cleanup: mockTmpDirCleanup
            }
        })
    }
})

vi.mock("../src/utils/syncFiles", () => {
    return {
        syncFiles: vi.fn()
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
    isCleanMockValue = false
})

describe("publish", () => {
    test("performs every step expected", async () => {
        const context: Context = createMockContext(mockLogger)
        const pluginContext: PluginContext = {
            repositoryUrl: THIS_REPO_URL,
            destinationRepositoryUrl: DEST_REPO_URL
        }

        await expect(
            publish(pluginContext, context)
        ).resolves.not.toThrowError()

        // clone called with right destination repo
        expect(mockSimpleGit.clone.mock.calls[0][0]).toEqual(DEST_REPO_URL);
        expect(mockLogger.info).toHaveBeenCalledWith("Cloned destination repo git@fakegit.com:destination.git to /tmp/fake-for-testing")

        // cwd called with same directory as clone command
        expect(mockSimpleGit.cwd).toHaveBeenCalledWith({path: "/tmp/fake-for-testing"})

        // sync called on correct directories
        expect(syncFiles).toHaveBeenCalledWith(mockCwd, "/tmp/fake-for-testing")
        expect(mockLogger.debug).toHaveBeenCalledWith("Synced files to cloned repository")

        expect(mockSimpleGit.status).toHaveBeenCalledTimes(1)
        expect(mockLogger.warn).not.toHaveBeenCalledWith("There are no changes to publish. Will publish an empty commit anyway.")

        expect(mockSimpleGit.commit).toHaveBeenCalledWith('Publishing version 1.0.0', {
            "--allow-empty": null
        });
        expect(mockLogger.debug).toHaveBeenCalledWith("Committed changes")

        expect(mockSimpleGit.addTag).toHaveBeenCalledWith("v1.0.0")

        expect(mockSimpleGit.push).toHaveBeenCalledTimes(1)
        expect(mockLogger.info).toHaveBeenCalledWith("Pushed commits to origin")

        expect(mockSimpleGit.pushTags).toHaveBeenCalledTimes(1)
        expect(mockLogger.info).toHaveBeenCalledWith("Pushed tags to origin")

        expect(mockLogger.info).toHaveBeenCalledWith("Finished publishing to destination Git repository")

        // ensure tmp directory is cleaned up
        expect(mockTmpDirCleanup).toHaveBeenCalledTimes(1)
    })

    test("included release notes in commit message", async () => {
        const context: Context = createMockContext(mockLogger)
        context.nextRelease.notes = "These are the release notes."
        const pluginContext: PluginContext = {
            repositoryUrl: THIS_REPO_URL,
            destinationRepositoryUrl: DEST_REPO_URL
        }

        await expect(
            publish(pluginContext, context)
        ).resolves.not.toThrowError()

        expect(mockSimpleGit.commit).toHaveBeenCalledWith('Publishing version 1.0.0\n\nThese are the release notes.', {
            "--allow-empty": null
        });
    })

    test("commits even when git status is clean", async () => {
        const context: Context = createMockContext(mockLogger)
        const pluginContext: PluginContext = {
            repositoryUrl: THIS_REPO_URL,
            destinationRepositoryUrl: DEST_REPO_URL
        }

        isCleanMockValue = true

        await expect(
            publish(pluginContext, context)
        ).resolves.not.toThrowError()

        expect(mockLogger.warn).toHaveBeenCalledWith("There are no changes to publish. Will publish an empty commit anyway.")

        expect(mockSimpleGit.commit).toHaveBeenCalledWith('Publishing version 1.0.0', {
            "--allow-empty": null
        });
    })

})