import {afterEach, describe, expect, test, vi} from "vitest";
import * as tmp from "tmp-promise";
import {promises as fs} from "fs";
import {simpleGit, StatusResult} from "simple-git";
import {syncFiles} from "../../src/utils/syncFiles.js"
import {compareSync} from "dir-compare";
import {getGitignoreFilter} from "../../src/utils/gitIgnoreFilter.js";

// keep track of tmp directories to clean them up, even if tests fail
let tmpDirs: tmp.DirectoryResult[] = []
async function cleanupTmpDirs() {
    for (const tmp of tmpDirs) {
        await tmp.cleanup()
    }
    tmpDirs = []
}

vi.mock('signale')

afterEach(async () => {
    vi.clearAllMocks()
    await cleanupTmpDirs()
})

async function setupTestGitDirectory(sourceDir: string|null, options?: {
    gitIgnoreContents?: string
}): Promise<string> {
    // make a copy of the test directory in a tmp directory
    const tmpDir = await tmp.dir({
        prefix: "syncFilesTest",
        unsafeCleanup: true
    })

    // initialize it as a git repository
    const git = simpleGit({baseDir: tmpDir.path});
    await git.init()

    // set an author for the repo
    await git.addConfig('user.name', 'Unit Tester', false, "local")
    await git.addConfig('user.email', 'test@test.com')

    // populate with initial files if source directory provided
    let shouldCommit = false
    if (options?.gitIgnoreContents) {
        await fs.writeFile(tmpDir.path + "/.gitignore", options.gitIgnoreContents)
        shouldCommit = true
    }
    if (sourceDir) {
        await fs.cp(sourceDir, tmpDir.path, {recursive: true})
        shouldCommit = true
    }
    if (shouldCommit) {
        await git.add("--all")
        await git.commit("add all test files")
    }

    // save for cleanup
    tmpDirs.push(tmpDir)

    // return directory
    return tmpDir.path
}

function getFullSourcePath(sourceDir: string) {
    return process.cwd() + "/test/utils/syncFilesExamples/" + sourceDir;
}

async function compareDirs(dirA: string, dirB: string) {
    return compareSync(dirA, dirB, {
        excludeFilter: ".git",
        compareContent: true,
    });
}

// ignore files ignored by gitignore
async function compareDirsRespectGitIgnore(dirA: string, dirB: string) {
    return compareSync(dirA, dirB, {
        filterHandler: getGitignoreFilter(dirA, dirB),
        includeFilter: "*",
        compareContent: true,
    });
}

async function getGitStatus(dir: string) {
    const git = simpleGit({baseDir: dir});
    return git.status();
}

function expectGitStatus(
    gitStatus: StatusResult,
    {
        not_added = [],
        conflicted = [],
        created = [],
        deleted = [],
        modified = [],
        renamed = [],
        staged = []
        }: {
        not_added?: string[],
        conflicted?: string[],
        created?: string[],
        deleted?: string[],
        modified?: string[],
        renamed?: string[],
        staged?: string[]
    })
{
    expect(not_added.sort()).toEqual(gitStatus.not_added.sort())
    expect(conflicted.sort()).toEqual(gitStatus.conflicted.sort())
    expect(created.sort()).toEqual(gitStatus.created.sort())
    expect(deleted.sort()).toEqual(gitStatus.deleted.sort())
    expect(modified.sort()).toEqual(gitStatus.modified.sort())
    expect(renamed.sort()).toEqual(gitStatus.renamed.sort())
    expect(staged.sort()).toEqual(gitStatus.staged.sort())
}

describe("syncFiles", () => {
    test("does nothing when both directories are empty", async () => {

        const tmpDirSource = await setupTestGitDirectory(null)
        const tmpDirDest = await setupTestGitDirectory(null);

        await syncFiles(tmpDirSource, tmpDirDest)

        const difference = await compareDirs(tmpDirSource, tmpDirDest)
        expect(difference.same).toBe(true)

        const gitStatus = await getGitStatus(tmpDirDest)
        expect(gitStatus.isClean()).toBe(true)
        expectGitStatus(gitStatus, {})
    })

    test("copies a single file to an empty directory", async ()=> {
        const sourceDir = getFullSourcePath("one-file")
        const tmpDestDir = await setupTestGitDirectory(null);

        await syncFiles(sourceDir, tmpDestDir)

        const difference = await compareDirs(sourceDir, tmpDestDir)
        expect(difference.same).toBe(true)

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            created: ["a.txt"],
            staged: ["a.txt"]
        })
    })

    test("deletes a single file ", async ()=> {
        const tmpSourceDir = await setupTestGitDirectory(null);
        const exampleDir = getFullSourcePath("one-file")
        const tmpDestDir = await setupTestGitDirectory(exampleDir);

        await syncFiles(tmpSourceDir, tmpDestDir)

        const difference = await compareDirs(tmpSourceDir, tmpDestDir)
        expect(difference.same).toBe(true)

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            deleted: ["a.txt"],
            staged: ["a.txt"]
        })
    })

    test("updates a single file ", async ()=> {
        const sourceDir = getFullSourcePath("one-file-different")
        const exampleDir = getFullSourcePath("one-file")
        const tmpDestDir = await setupTestGitDirectory(exampleDir);

        await syncFiles(sourceDir, tmpDestDir)

        const difference = await compareDirs(sourceDir, tmpDestDir)
        expect(difference.same).toBe(true)

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            modified: ["a.txt"],
            staged: ["a.txt"]
        })
    })

    test("copies a nested file to an empty directory", async ()=> {
        const sourceDir = getFullSourcePath("one-file-in-directory")
        const tmpDestDir = await setupTestGitDirectory(null);

        await syncFiles(sourceDir, tmpDestDir)

        const difference = await compareDirs(sourceDir, tmpDestDir)
        expect(difference.same).toBe(true)

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            created: ["subdirectory/nested.txt"],
            staged: ["subdirectory/nested.txt"]
        })
    })

    test("deletes a single nested file ", async ()=> {
        const tmpSourceDir = await setupTestGitDirectory(null);
        const exampleDir = getFullSourcePath("one-file-in-directory")
        const tmpDestDir = await setupTestGitDirectory(exampleDir);

        await syncFiles(tmpSourceDir, tmpDestDir)

        const difference = await compareDirs(tmpSourceDir, tmpDestDir)
        expect(difference.same).toBe(true)

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            deleted: ["subdirectory/nested.txt"],
            staged: ["subdirectory/nested.txt"]
        })
    })

    test("updates a nested file ", async ()=> {
        const sourceDir = getFullSourcePath("one-file-in-directory-different")
        const exampleDir = getFullSourcePath("one-file-in-directory")
        const tmpDestDir = await setupTestGitDirectory(exampleDir);

        await syncFiles(sourceDir, tmpDestDir)

        const difference = await compareDirs(sourceDir, tmpDestDir)
        expect(difference.same).toBe(true)

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            modified: ["subdirectory/nested.txt"],
            staged: ["subdirectory/nested.txt"]
        })
    })

    test("handles a complicated change", async ()=> {
        const sourceDir = getFullSourcePath("complex-source")
        const exampleDir = getFullSourcePath("complex-destination")
        const tmpDestDir = await setupTestGitDirectory(exampleDir);

        await syncFiles(sourceDir, tmpDestDir)

        const difference = await compareDirs(sourceDir, tmpDestDir)
        expect(difference.same).toBe(true)

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            deleted: [
                "root2.txt",
                "dirOne/one.txt",
                "dirOne/one2.txt",
                "dirTwo/nested/nested/double-nested3.txt"
            ],
            modified: [
                "root.txt"
            ],
            created: [
                "empty/file.txt",
            ],
            staged: [
                "root2.txt",
                "dirOne/one.txt",
                "dirOne/one2.txt",
                "dirTwo/nested/nested/double-nested3.txt",
                "root.txt",
                "empty/file.txt",
            ]
        })
    })

    // This test has a file updated and added inside the /ignored directory
    // We can't actually save the .gitignore files, so we add them in setupTestGitDirectory
    test("handles updating and adding .gitignored files", async ()=> {
        const sourceDir = getFullSourcePath("git-ignore-source")
        const exampleDir = getFullSourcePath("git-ignore-destination")
        const tmpSourceDir = await setupTestGitDirectory(sourceDir, {
            gitIgnoreContents: "ignored"
        });
        const tmpDestDir = await setupTestGitDirectory(exampleDir, {
            gitIgnoreContents: "ignored"
        });

        await syncFiles(tmpSourceDir, tmpDestDir)

        // the directories are not the same after sync because the gitignored filters were not copied
        const difference = await compareDirs(tmpSourceDir, tmpDestDir)
        expect(difference.same).toBe(false)

        // the directories are the same when taking gitignore into account
        const gitIgnoreDifference = await compareDirsRespectGitIgnore(tmpSourceDir, tmpDestDir)
        expect(gitIgnoreDifference.same).toBe(true)

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(true)

        expectGitStatus(gitStatus, {
        })
    })

    test("one excludeFilter ignores one file in root", async() => {
        const sourceDir = getFullSourcePath("exclude-filter-source")
        const tmpDestDir = await setupTestGitDirectory(null);

        const excludeFilters = ["a.txt"]

        await syncFiles(sourceDir, tmpDestDir, excludeFilters)

        const difference = await compareDirs(sourceDir, tmpDestDir)
        expect(difference.same).toBe(false) // not the same

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            created: [
                "subdirectory/sub1.txt",
                "subdirectory/sub2.txt"
            ],
            staged: [
                "subdirectory/sub1.txt",
                "subdirectory/sub2.txt"
            ]
        })
    })

    test("one excludeFilter ignores subdirectory", async() => {
        const sourceDir = getFullSourcePath("exclude-filter-source")
        const tmpDestDir = await setupTestGitDirectory(null);

        const excludeFilters = ["subdirectory"]

        await syncFiles(sourceDir, tmpDestDir, excludeFilters)

        const difference = await compareDirs(sourceDir, tmpDestDir)
        expect(difference.same).toBe(false) // not the same

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            created: [
                "a.txt",
            ],
            staged: [
                "a.txt"
            ]
        })
    })

    test("one excludeFilter ignores one file in subdirectory", async() => {
        const sourceDir = getFullSourcePath("exclude-filter-source")
        const tmpDestDir = await setupTestGitDirectory(null);

        const excludeFilters = ["/subdirectory/sub1.txt"]

        await syncFiles(sourceDir, tmpDestDir, excludeFilters)

        const difference = await compareDirs(sourceDir, tmpDestDir)
        expect(difference.same).toBe(false) // not the same

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            created: [
                "a.txt",
                "subdirectory/sub2.txt"
            ],
            staged: [
                "a.txt",
                "subdirectory/sub2.txt"
            ]
        })
    })

    test("one excludeFilter ignores one file with glob match", async() => {
        const sourceDir = getFullSourcePath("exclude-filter-source")
        const tmpDestDir = await setupTestGitDirectory(null);

        const excludeFilters = ["/**/*2.txt"]

        await syncFiles(sourceDir, tmpDestDir, excludeFilters)

        const difference = await compareDirs(sourceDir, tmpDestDir)
        expect(difference.same).toBe(false) // not the same

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            created: [
                "a.txt",
                "subdirectory/sub1.txt"
            ],
            staged: [
                "a.txt",
                "subdirectory/sub1.txt"
            ]
        })
    })

    test("one excludeFilter ignores json and js filetypes with two glob matches", async() => {
        const sourceDir = getFullSourcePath("exclude-filter-extensions-source")
        const tmpDestDir = await setupTestGitDirectory(null);

        const excludeFilters = ["**/*.json", "**/*.js"]

        await syncFiles(sourceDir, tmpDestDir, excludeFilters)

        const difference = await compareDirs(sourceDir, tmpDestDir)
        expect(difference.same).toBe(false) // not the same

        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            created: [
                "a.txt",
                "b.java",
                "subdirectory/1.txt",
                "subdirectory/2.java"
            ],
            staged: [
                "a.txt",
                "b.java",
                "subdirectory/1.txt",
                "subdirectory/2.java"
            ]
        })
    })

    // same as above test, but gitignore also excludes java files
    test("exclude filter and gitignore work together", async() => {
        const sourceDir = getFullSourcePath("exclude-filter-extensions-source")
        const tmpSourceDir = await setupTestGitDirectory(sourceDir, {
            gitIgnoreContents: "**/*.java"
        })
        const tmpDestDir = await setupTestGitDirectory(null, {
            gitIgnoreContents: "**/*.java"
        });

        const excludeFilters = ["**/*.json", "**/*.js"]

        await syncFiles(tmpSourceDir, tmpDestDir, excludeFilters)


        const gitStatus = await getGitStatus(tmpDestDir)
        expect(gitStatus.isClean()).toBe(false)

        expectGitStatus(gitStatus, {
            created: [
                "a.txt",
                "subdirectory/1.txt"
            ],
            staged: [
                "a.txt",
                "subdirectory/1.txt"
            ]
        })
    })


})