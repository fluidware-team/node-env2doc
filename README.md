# env2doc

This tool helps you to keep track of all environment variables used - if accessed through `@fluidware-it/saddleback` `EnvParse` functions.

## Usage

it can be used via `npx`

```
npx @fluidware-it/env2doc -p /path/to/javascript/files
```

or it can be installed globally and then used 

```
npm i -g @fluidware-it/env2doc

env2doc -p /path/to/javascript/files

```

by default, it outputs in Markdown format. Use `-o json` arg to output in JSON format

### Examples

```
node @fluidware-it/env2doc -p ~/Projects/fluidware/express-microservice/build/src

## Environment variables

| ENV                           |     type |                        default | required |
| ----------------------------- | -------- | ------------------------------ | -------- |
| FW_MS_PRE_SHARED_TOKEN_PREFIX |   string |                                |          |
| FW_MS_PORT                    |  integer |                           8080 |          |
| FW_MS_LOG_404                 |  boolean |                          false |          |
| FW_MS_HOSTNAME                |   string |          default to hostname() |          |
| FW_MS_ADDRESS                 |   string |                                |          |
| FW_MS_ADDRESSES               | string[] |                                |          |
| FW_MS_TRUST_PROXY             | string[] | loopback,linklocal,uniquelocal |          |
| FW_MS_MAX_UPLOAD_SIZE         |   string |                          128kb |          |
| FW_MS_JWT_PUBLIC_KEY          |   string |                                |          |
| FW_MS_KEY                     |   string |                                |          |
| FW_MS_CERT                    |   string |                                |          |
```
