import {compareSync, Difference} from "dir-compare";
import {SimpleGit, simpleGit} from "simple-git";
import {promises as fs, existsSync} from "fs";
import {getGitignoreFilter} from "./gitIgnoreFilter.js";

/**
 * Makes the destination directory equal to the source directory, by modifying files and running git commands
 *
 * @param sourceDir source directory of files
 * @param destDir destination directory (must be a Git repo)
 */
export async function syncFiles(sourceDir: string, destDir: string) {
    const git = simpleGit({baseDir: destDir});

    const difference = compareSync(sourceDir, destDir, {
        filterHandler: getGitignoreFilter(sourceDir, destDir),
        includeFilter: "*",
        compareContent: true,
    });
    const diffs = difference.diffSet.filter(diff => diff.state != "equal")

    for (const diff of diffs) {
        switch (diff.state) {
            case "equal":
                // do nothing
                break;
            case "left":
                // need to create something
                switch (diff.type1) {
                    case "file":
                        await createFile(destDir, diff, git)
                        break;
                    case "directory":
                        await createDirectory(destDir, diff)
                        break;
                    default:
                        throw new Error(`Creating [${diff.type1}] not supported`)
                }
                break;
            case "right":
                // need to remove something
                switch (diff.type2) {
                    case "file":
                        await removeFile(destDir, diff, git)
                        break;
                    case "directory":
                        // do nothing, git only cares about files
                        break;
                    default:
                        throw new Error(`Removing [${diff.type2}] not supported`)
                }
                break;
            case "distinct":
                // need to update something
                switch (diff.type1) {
                    case "file":
                        await updateFile(destDir, diff, git)
                        break;
                    default:
                        throw new Error(`Updating [${diff.type1}] not supported`)
                }
                break;
            default:
                throw new Error(`Handling differences of type [${diff.state}] not supported`)
        }
    }
}

async function createFile(destRootDir: string, diff: Difference, git: SimpleGit) {
    // create directory if it does not exist
    const destDir = destRootDir + diff.relativePath;
    if (!existsSync(destDir)) {
        await fs.mkdir(destDir, {recursive: true})
    }

    // copy file to destination
    const sourceFile = diff.path1 + "/" + diff.name1;
    const destFile = destDir + "/" + diff.name1;
    await fs.copyFile(sourceFile, destFile, fs.constants.COPYFILE_EXCL)

    // git add
    await gitAddIfNotIgnored(git, destFile);
}

async function createDirectory(destRootDir: String, diff: Difference) {
    // check if exists already
    const destDir = destRootDir + "/" + diff.name1;
    if (existsSync(destDir)) {
        return
    }

    // create directory
    await fs.mkdir(destDir)
}

async function removeFile(destDir: string, diff: Difference, git: SimpleGit) {
    // git remove (this deletes the file too)
    const destFile = diff.path2 + "/" + diff.name2;
    await git.rm(destFile)
}

async function updateFile(destDir: string, diff: Difference, git: SimpleGit) {
    // copy to overwrite the existing file
    const sourceFile = diff.path1 + "/" + diff.name1;
    const destFile = diff.path2 + "/" + diff.name2;
    await fs.copyFile(sourceFile, destFile, fs.constants.COPYFILE_FICLONE)
    // git add

    await gitAddIfNotIgnored(git, destFile)
}

async function gitAddIfNotIgnored(git: SimpleGit, file: string) {
    // checkIgnore returns an array of ignored files. If nothing is returned, we can git add
    const result = await git.checkIgnore(file)
    if (result.length > 0) {
        return;
    }
    await git.add(file)
}