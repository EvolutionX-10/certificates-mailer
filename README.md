# Certificates Mailer

Generate personalized PDF or PNG certificates from a CSV, then email PDF certificates through your SMTP provider. Built with [Bun](https://bun.sh/), TypeScript 7, Nodemailer, pdf-lib, Sharp, and Handlebars.

The default entrypoint generates sample PDFs and sends **one real email to `TEST_EMAIL`**. Live bulk delivery must be enabled explicitly in `src/index.ts`.

## Requirements

- **Bun 1.4.5 or newer**; CI uses 1.4.5. Install it using the [Bun installation guide](https://bun.sh/docs/installation).
- An SMTP account that supports authenticated TLS connections.
- Your recipient CSV, a blank certificate PDF, and an HTML email template. These inputs are private/local files and are not included in this repository.
- For custom PDF fonts, a licensed `.ttf` font file. For PNG generation, a base image and an installed system font.

## Quick start

Run these commands from the project root:

```sh
git clone https://github.com/EvolutionX-10/certificates-mailer.git
cd certificates-mailer
bun install --frozen-lockfile
cp .env.example .env
mkdir -p assets templates
```

1. Edit `.env` with your SMTP credentials, sender, subject, and a test mailbox you control. Bun loads `.env` automatically; existing shell environment variables take precedence.
2. Save your blank certificate as `assets/certificate.pdf`. The name is drawn on its first page.
3. Create `assets/data.csv` with the following headers and your actual recipients:

   ```csv
   Name,Email
   Alex de Silva,alex@example.com
   Morgan Lee,morgan@example.org
   ```

4. Create `templates/template.html`:

   ```html
   <p>Hello {{name}},</p>
   <p>Thank you for participating. Your certificate is attached.</p>
   ```

5. Run the local checks, then run the mailer when ready to send a test email:

   ```sh
   bun run typecheck
   bun test
   bun start
   ```

The default run generates PDFs for up to three sampled CSV recipients plus the test recipient, then emails only the test recipient. Review the files in `OUTPUT_PDF` and the received email before enabling live delivery. Output and statistics directories are created automatically.

`bun test` runs in temporary directories and composes email locally; it does not contact an SMTP server or require your credentials or certificate inputs.

## Configuration

Copy `.env.example` rather than committing credentials. All relative paths resolve from the directory where you run Bun, normally the project root.

| Variable                  | Purpose / default                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SMTP_HOST`               | Required SMTP hostname.                                                                                                                                                  |
| `SMTP_PORT`               | SMTP port; defaults to `587`.                                                                                                                                            |
| `SMTP_SECURE`             | Optional `true` or `false`. Defaults to `true` on port 465 and `false` otherwise. `true` uses implicit TLS; `false` requires STARTTLS.                                   |
| `SMTP_USER`, `SMTP_PASS`  | Required SMTP credentials. Use an app password if your provider requires one.                                                                                            |
| `FROM`, `SUBJECT`         | Sender address (optionally with a display name) and email subject.                                                                                                       |
| `CSV_FILE`                | Recipient CSV path; required for the standard workflow.                                                                                                                  |
| `TEMPLATE_FILE`           | Handlebars HTML template path; required when passing an object to `send`/`sendBulk`.                                                                                     |
| `BASE_PDF`, `OUTPUT_PDF`  | Blank PDF path and generated PDF directory; needed for PDF generation/attachments.                                                                                       |
| `BASE_IMG`, `OUTPUT_IMG`  | Base image path and generated PNG directory; needed only for image generation.                                                                                           |
| `FONT`                    | PDF: a [standard PDF font](https://pdf-lib.js.org/docs/api/enums/standardfonts), such as `Helvetica`, or the basename of `assets/<FONT>.ttf`. PNG: a system font family. |
| `FONT_SIZE`               | Positive font size: PDF points or PNG pixels.                                                                                                                            |
| `TEST_NAME`, `TEST_EMAIL` | Required in test mode. Use your own name and mailbox.                                                                                                                    |
| `STATS_DIR`               | Delivery log directory; defaults to `./stats`. Use a separate directory for each campaign.                                                                               |

SMTP certificate validation stays enabled. Connections use implicit TLS or require STARTTLS; plaintext SMTP is not supported by the default client.

## Live delivery and retries

In `src/index.ts`, uncomment this line **before** generation and sending:

```ts
await client.setTestMode(false);
```

Run `bun start` again. After a five-second warning, it generates a certificate for every CSV recipient and sends each recipient their own PDF. Messages are processed sequentially to bound memory use and avoid a burst of SMTP requests; provider quotas and sending limits still apply.

- `accepted.txt` records recipients accepted by the SMTP server. This is not confirmation of inbox delivery.
- `rejected.txt` records failed attempts. Failures are reported through a rejected promise and a nonzero CLI exit status after the remaining recipients are attempted.
- Subsequent live runs skip exact email addresses already in `accepted.txt` for the current `STATS_DIR`.
- Test sends use separate `test-accepted.txt` and `test-rejected.txt` files and are never skipped.

Keep the same `STATS_DIR` when retrying a campaign. Choose a new directory for a new campaign; reusing an old accepted log skips those addresses even if the template or certificate changes. Do not run concurrent campaigns against the same logs or output directories. If a process is interrupted after SMTP acceptance but before logging it, check provider records before retrying to avoid duplicates.

Generated filenames use the SHA-256 hash of the complete, trimmed email address. Recipients sharing an email username at different domains receive separate certificates. Display names are preserved, including capitalization and middle names; surrounding/repeated whitespace is normalized. CSV parsing accepts a UTF-8 BOM and blank lines, and rejects missing names, invalid addresses, duplicate exact addresses, and empty recipient lists before any mail is sent.

## Customization

The default CSV mapping expects case-sensitive `Name` and `Email` headers. Change `parserFn` in `src/index.ts` for other column names:

```ts
const client = new Client({
	parserFn: (row) => ({ name: row["Full Name"], email: row["Email Address"] }),
});
```

Pass extra template variables with `await client.sendBulk({ event: "Community Workshop" }, true)` and use `{{event}}` in the HTML. `{{name}}` is the recipient's first name and is supplied by the client. Handlebars escapes values by default.

Available generation modes are `await client.generateAssets("pdf")`, `"img"`, and `"both"`. `sendBulk({}, true)` attaches a PDF; PNG generation alone does not provide an email attachment. Use `sendBulk({}, false)` for email without a certificate.

For PDF layout, adjust the coordinates/color in `src/utils/genPDF.ts`. Names are horizontally centered using the embedded font's measured text width. For PNG layout, adjust the SVG in `src/utils/genImg.ts`; names are centered at 55% of the image height. Check long names and non-Latin text with your actual font. Standard PDF fonts have limited character coverage; use a suitable TTF for broader coverage. PNG fonts must be installed on the machine; placing a TTF in `assets/` only configures PDF embedding.

When using `Client` in your own script, close it in `finally`, as the entrypoint does. `sendBulk` reuses the data loaded by `generateAssets` so attachments and recipients refer to the same CSV snapshot. Call `getData()` explicitly to reload changed input. In test mode, `send` also rejects any recipient other than `TEST_EMAIL`.

## Development

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun audit
```

### TypeScript 7 tooling

The project uses the stable **TypeScript 7.0.2 native compiler**, pinned in `package.json` and `bun.lock`. `bun run typecheck` runs the installed `tsc` launcher through Bun, which invokes TypeScript's platform-specific native executable. A separate Node.js installation is not required for this command. Keep optional dependencies enabled when installing: they include the compiler binary for your operating system and architecture.

```sh
bun run typecheck --version  # Version 7.0.2
bun run typecheck:watch      # Recheck when source or test files change
```

Type checking covers `src/`, `tests/`, and the environment declarations in `types/` using `tsconfig.json`. It does not emit JavaScript; Bun executes the TypeScript application directly via `bun start`. Bun's runtime transpilation does not replace the compiler's type checks.

CI runs the development checks and prints the TypeScript compiler version on Ubuntu with the pinned Bun version. Tests cover CSV validation, PDF/PNG generation, real MIME attachment composition, test-recipient isolation, delivery failures, and retry logs. Live SMTP delivery still needs a test with your provider and credentials.

| Path                                         | Responsibility                                         |
| -------------------------------------------- | ------------------------------------------------------ |
| `src/index.ts`                               | CSV mapping and test/live workflow.                    |
| `src/utils/client.ts`                        | SMTP transport, templates, sending, and delivery logs. |
| `src/utils/parseData.ts`                     | CSV parsing and recipient validation.                  |
| `src/utils/assetGenerator.ts`                | Sample selection and certificate generation.           |
| `src/utils/genPDF.ts`, `src/utils/genImg.ts` | PDF text embedding and PNG compositing.                |
| `src/utils/assetPath.ts`                     | Shared recipient-to-certificate path mapping.          |
| `tests/`                                     | Isolated offline regression tests.                     |

Dependencies were refreshed against the npm registry in November 2026. The committed text `bun.lock` replaces the older binary `bun.lockb` and makes installs reproducible. Review future dependency upgrades with the checks above.

## Upgrading an existing checkout

- Replace `HOST`, `USER`, and `PASS` in `.env` with `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS`. The old names are no longer read; `USER` commonly conflicts with the shell username.
- Upgrade Bun and reinstall using `bun install --frozen-lockfile`.
- Regenerate certificates before sending: old filenames based only on the email username are no longer used. Configured output directories no longer need a trailing slash.
- Review full names and template output: middle names and original capitalization are now retained.
- Review existing delivery logs and set a campaign-specific `STATS_DIR`. Old test emails may have been recorded in the live `accepted.txt` by earlier versions.

## Troubleshooting

- **Missing environment variable or file:** check `.env`, the command's working directory, CSV header mapping, and that local assets/templates exist.
- **SMTP authentication/TLS errors:** verify host, port, credentials, app-password requirements, and sender permissions with your provider. Use port 465 for implicit TLS or 587 for STARTTLS unless your provider specifies otherwise.
- **Sharp cannot load:** reinstall with the supported Bun version and optional dependencies enabled. Sharp uses platform-specific native binaries; see its [installation guide](https://sharp.pixelplumbing.com/install/) for supported platforms.
- **Font or encoding errors:** check `assets/<FONT>.ttf` for custom PDF fonts and use a font that contains every recipient's characters. Install the corresponding system font for PNG output.
- **Recipients are skipped:** inspect `STATS_DIR/accepted.txt` and confirm it belongs to this campaign.

Local `.env` files, CSVs, `assets/`, `templates/`, and the default output/log directories (`pdf/`, `image/`, `stats/`) are ignored by Git. If you configure other output or log directories, add them to `.gitignore`. Keep recipient data private when sharing logs or example inputs.

Licensed under the [MIT License](LICENSE.md).
