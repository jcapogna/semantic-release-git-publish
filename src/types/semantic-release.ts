import { Signale } from "signale";

export interface LastRelease {
    version: string;
    gitTag: string;
    gitHead: string;
}

export interface NextRelease extends LastRelease {
    notes: string;
}

/**
 * The context object defined in semantic-release/index.js
 * @see https://github.com/semantic-release/semantic-release/blob/v15.13.3/index.js
 */
export interface Context {
    // https://nodejs.org/docs/latest-v8.x/api/process.html#process_process_cwd
    cwd: string;
    // https://nodejs.org/docs/latest-v8.x/api/process.html#process_process_env
    env: object;
    // https://nodejs.org/docs/latest-v8.x/api/process.html#process_process_stdout
    stdout: WritableStream;
    // https://nodejs.org/docs/latest-v8.x/api/process.html#process_process_stderr
    stderr: WritableStream;
    // https://github.com/semantic-release/semantic-release/blob/v15.13.3/lib/get-config.js
    options: object;
    nextRelease: NextRelease;
    logger: Signale;
}

export interface PluginContext {
    // the repository being published
    repositoryUrl: string,

    // option: the destination repository url
    destinationRepositoryUrl: string
}

