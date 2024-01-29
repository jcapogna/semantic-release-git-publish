import {Context, PluginContext} from "./types/semantic-release.js";
import {Signale} from "signale";
import {simpleGit} from "simple-git";

import SemanticReleaseError from '@semantic-release/error';


async function verifyConditions(
    pluginContext: PluginContext,
    context: Context,
) {
    const { logger } = context;

    // Verify there is a destinationRepositoryUrl option
    if (!pluginContext.destinationRepositoryUrl) {
        throw new SemanticReleaseError("Plugin configuration missing 'destinationRepositoryUrl'")
    }

    // Verify source and destination are different
    if (pluginContext.destinationRepositoryUrl == pluginContext.repositoryUrl) {
        throw new SemanticReleaseError("The source and destination repository are the same. You must publish to another repository")
    }

    // Verify we can connect to the destination repo
    const destinationRepoExists = await checkRepositoryExists(pluginContext.destinationRepositoryUrl, logger);
    if(!destinationRepoExists) {
        throw new SemanticReleaseError(`Unable to connect to destination repository at ${pluginContext.destinationRepositoryUrl}`)
    }
    logger.info(`Successfully connected to git repo ${pluginContext.destinationRepositoryUrl}`)

    logger.info("Verified conditions, and found no problem");
}

async function checkRepositoryExists(repoUrl: string, logger: Signale): Promise<boolean> {
    const git = simpleGit();
    try {
        await git.listRemote([repoUrl])
        return true;
    } catch (e) {
        const errorMsg = (e as {message:string}).message
        logger.error(`Unable to connect to destination repository ${repoUrl}. See error\n:${errorMsg}`)
        return false;
    }
}


export {verifyConditions}
