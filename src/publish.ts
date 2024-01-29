import {Context, PluginContext} from "./types/semantic-release.js";
import * as tmp from "tmp-promise";
import {simpleGit} from "simple-git";
import {syncFiles} from "./utils/syncFiles.js";

async function publish(
    pluginContext: PluginContext,
    context: Context,
) {
    const {
        cwd,
        logger,
        nextRelease
    } = context;

    const tmpDir = await tmp.dir({
        prefix: "semantic-release-git-publish",
        unsafeCleanup: true
    })
    try {
        const git = simpleGit({ baseDir: tmpDir.path });

        // Clone the destination repository
        await git.clone(pluginContext.destinationRepositoryUrl, tmpDir.path);
        logger.info(`Cloned destination repo ${pluginContext.destinationRepositoryUrl} to ${tmpDir.path}`)

        // Sync this project to it
        await syncFiles(cwd, tmpDir.path)
        logger.debug(`Synced files to cloned repository`)

        // Check if there are changes to commit
        const status = await git.status()
        if (status.isClean()) {
            logger.warn("There are no changes to publish. Will publish an empty commit anyway.")
        }

        // Commit the changes
        let commitMsg = `Publishing version ${nextRelease.version}`;
        if (nextRelease.notes) {
            commitMsg += "\n\n" + nextRelease.notes
        }
        await git.commit(commitMsg, {
            "--allow-empty": null // allows empty commits
        })
        logger.debug("Committed changes")

        // Tag the release
        await git.addTag("v" + nextRelease.version)

        // Push repository
        await git.push()
        logger.info("Pushed commits to origin")
        await git.pushTags()
        logger.info("Pushed tags to origin")

        logger.info("Finished publishing to destination Git repository")

    } catch (e) {
        logger.error("Error occurred during publish", e)
        throw e
    } finally {
        await tmpDir.cleanup()
    }
}

export {publish}

