# semantic-release-git-publish

A [**semantic-release**](https://github.com/semantic-release/semantic-release) plugin that publishes by syncing the contents of this repo to another another Git repository and tagging that repository with the release version.

## Use cases

This plugin was developed to facilitate publishing a Swift package inside of a monorepo. Along with the `semantic-release-monorepo` plugin, the Swift subpackage of the monorepo can be be "published" to it's own standalone repo for public consumption. 

There may be other use cases where this plugin is useful, such as creating a public copy of a private repository. 

## Plugin steps

| Step               | Description                                                                                                                                                       |
|--------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `verifyConditions` | Verifies that the `destinationRepositoryUrl` option is set to a valid Git repository.                                                                             |
| `publish`          | Clones the destination repository, updates the content to match the current working directory, commits the changes, and tags the commit with the release version. |

## Install

Install the plugin as a development dependency with

```bash
npm install semantic-release-git-publish --save-dev
```

## Usage

The plugin can be configured in the [**semantic-release** configuration file](https://github.com/semantic-release/semantic-release/blob/master/docs/usage/configuration.md#configuration):

```json
{
  "plugins": [
    "@semantic-release/git",
    [
      "semantic-release-git-publish",
      {
        "destinationRepositoryUrl": "git@gitlab.com:destination-repository.git"
      }
    ]
  ]
}
```

## Configuration

### Options

| Options                    | Description                            | Default |
|----------------------------|----------------------------------------|---------|
| `destinationRepositoryUrl` | The path to the destination repository |         |

## Known limitations

This plugin does not currently handle symlinks and possibly some other cases. It handles all scenarios involving changing files and directories. Anything not supported will log an error and cause the `publish` step to fail. For more details, see `/src/utils/syncFiles.ts`.

