# Repository guide for agents

## Project and toolchain

Certificates Mailer is a Bun CLI that reads recipients from CSV, generates PDF or PNG
certificates, and sends templated email through SMTP. Read `README.md` for setup and
`.env.example` for configuration.

Use Bun (the version pinned in `package.json` and CI) and the committed `bun.lock`.
TypeScript 7 performs type checking; Bun executes the TypeScript source directly.
There is no JavaScript build or generated application output to commit. Keep optional
package dependencies enabled: TypeScript and Sharp use platform-specific binaries.

## Code map

- `src/index.ts`: entrypoint, CSV column mapping, generation mode, and test/live workflow.
- `src/utils/client.ts`: SMTP transport, Handlebars rendering, delivery logs, and retries.
- `src/utils/parseData.ts`: CSV parsing, recipient validation, and name normalization.
- `src/utils/assetGenerator.ts`: sample selection and sequential certificate generation.
- `src/utils/assetPath.ts`: shared recipient-to-file mapping for generation and attachments.
- `src/utils/genPDF.ts` and `genImg.ts`: PDF text placement/font embedding and PNG compositing.
- `src/utils/config.ts`: required environment values and font-size validation.
- `src/utils/fileUtil.ts`: file operations and recursive directory creation.
- `types/env.d.ts`: optional environment variable declarations; values still need runtime validation.
- `tests/workflow.test.ts`: offline workflow tests with temporary assets and a local MIME transport.

## Commands and verification

Run commands from the repository root:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun audit
```

Use `bun run typecheck:watch` for ongoing compiler feedback. When changing dependencies,
update `package.json` and `bun.lock` together and check native package compatibility.
CI runs the commands above on Ubuntu and prints the compiler version.

`bun start` sends a real email even in test mode. Do not use it as a routine validation
command or disable test mode to run checks. Use the offline tests for development;
SMTP delivery requires an explicit request and a configured test mailbox.

## Behavior to preserve

- Default to test mode. Test sends must target only `TEST_EMAIL`; test asset generation
  must include that recipient even if a CSV participant has the same name.
- Validate the entire CSV before sending. Preserve name spelling, capitalization, and
  middle components while normalizing whitespace. Reject duplicate exact addresses.
- Use `assetPath` for both generated filenames and attachments. It hashes the full,
  trimmed email address so usernames shared across domains cannot collide. Honor the
  configured output directories without requiring a trailing slash.
- Reuse the loaded recipient data between generation and sending; do not silently
  reread a changed CSV between those operations.
- Keep test and live delivery logs separate. Skip accepted live recipients on retry,
  propagate delivery failures, and close the SMTP transport in `finally` in entrypoints.
- Preserve implicit TLS or required STARTTLS and certificate validation. Do not trim
  meaningful whitespace from SMTP passwords.
- Keep generation and delivery memory use bounded. Escape names inserted into SVG and
  retain Handlebars' default escaping for template values.

## Editing and test conventions

Follow the existing TypeScript ESM style: explicit `.ts` extensions on relative imports,
`import type` for types, tabs, and the formatting in `.prettierrc`. Path aliases live in
`tsconfig.json`; avoid introducing a second alias configuration.

For behavior changes, extend the offline workflow tests where appropriate. They change
`process.cwd()` and environment variables, so do not run those cases concurrently;
restore process state and clean up temporary files. Fixtures should be synthetic and
self-contained rather than depend on ignored local assets or SMTP credentials.

Keep `.env` files, recipient CSVs, local templates/fonts, generated certificates, and
logs out of commits. Custom output/log directories may need additional ignore rules.
Update `README.md`, `.env.example`, and `types/env.d.ts` when configuration or user-visible
workflow changes.
