import { createTransport, type Transporter } from "nodemailer";
import { compile } from "handlebars";
import { greenBright, redBright, yellowBright } from "colorette";
import { Stopwatch } from "@sapphire/stopwatch";
import { join } from "node:path";
import { parseData, validateRecipient, type ParsedData } from "./parseData.ts";
import { FileUtil } from "./fileUtil.ts";
import { AssetGenerator } from "./assetGenerator.ts";
import { assetPath } from "./assetPath.ts";
import { requiredEnv } from "./config.ts";

export class Client {
	public transport: Transporter;
	public testMode = true;
	public data?: ParsedData[];
	public parserFn: (data: Record<string, string>) => ParsedData;

	public constructor({ parserFn }: { parserFn: (data: Record<string, string>) => ParsedData }) {
		const port = Number(process.env.SMTP_PORT || "587");
		if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT must be between 1 and 65535");
		const secureSetting = process.env.SMTP_SECURE;
		if (secureSetting && secureSetting !== "true" && secureSetting !== "false") {
			throw new Error("SMTP_SECURE must be true or false");
		}
		const secure = secureSetting ? secureSetting === "true" : port === 465;
		this.transport = createTransport({
			host: requiredEnv("SMTP_HOST"),
			port,
			secure,
			requireTLS: !secure,
			pool: true,
			auth: { user: requiredEnv("SMTP_USER"), pass: requiredEnv("SMTP_PASS", false) },
		});
		this.parserFn = parserFn;
	}

	public async setTestMode(mode: boolean) {
		if (!mode) {
			console.log(`${yellowBright("[WARN]")} Test Mode is set to false! Proceeding in 5s...`);
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
		this.testMode = mode;
	}

	public async getData() {
		this.data = await parseData(this.parserFn);
	}

	public async generateAssets(type: "img" | "pdf" | "both") {
		await this.getData();
		const watch = new Stopwatch();
		await AssetGenerator.generateAsset(type, this.data!, this.testMode);
		console.log(`${greenBright("[INFO]")} Asset Generation Time taken: ${watch.stop()}`);
	}

	private statsPath(status: "accepted" | "rejected") {
		return join(process.env.STATS_DIR || "./stats", `${this.testMode ? "test-" : ""}${status}.txt`);
	}

	/** Send one recipient; in test mode only TEST_EMAIL is allowed. Failures reject. */
	public async send(data: ParsedData, body: string | Record<string, string>, attachment = false) {
		data = validateRecipient(data);
		if (this.testMode && data.email !== requiredEnv("TEST_EMAIL")) {
			throw new Error("Test mode only permits sending to TEST_EMAIL");
		}
		try {
			const result = await this.transport.sendMail({
				from: requiredEnv("FROM"),
				to: { name: data.name, address: data.email },
				subject: requiredEnv("SUBJECT"),
				html: typeof body === "string" ? body : compile(FileUtil.read(requiredEnv("TEMPLATE_FILE")))(body),
				attachments: attachment
					? [{ filename: "certificate.pdf", contentType: "application/pdf", path: assetPath(data.email, "pdf") }]
					: [],
			});
			if (!result.accepted?.length) throw new Error(`SMTP server did not accept ${data.email}`);
			FileUtil.append(this.statsPath("accepted"), data.email + "\n");
			console.log(`${greenBright("[SUCCESS]")} ${data.email}`);
		} catch (error) {
			FileUtil.append(this.statsPath("rejected"), data.email + "\n");
			console.error(`${redBright("[FAILED]")} ${data.email}`);
			throw error;
		}
	}

	/** Reuse generated recipients, skip accepted live recipients, and report all failures. */
	public async sendBulk(body: Record<string, string> = {}, attachment = false) {
		if (!this.data) await this.getData();
		const watch = new Stopwatch();
		const recipients = this.testMode
			? [validateRecipient({ name: requiredEnv("TEST_NAME"), email: requiredEnv("TEST_EMAIL") })]
			: this.data!;
		const accepted = new Set(this.testMode ? [] : FileUtil.readOptional(this.statsPath("accepted")).split(/\r?\n/));
		const errors: unknown[] = [];
		for (const recipient of recipients) {
			if (accepted.has(recipient.email)) {
				console.log(`${yellowBright("[SKIPPED]")} ${recipient.email}`);
				continue;
			}
			try {
				await this.send(recipient, { ...body, name: recipient.name.split(" ")[0] }, attachment);
			} catch (error) {
				errors.push(error);
			}
		}
		console.log(`${greenBright("[INFO]")} Emailing Time taken: ${watch.stop()}`);
		if (errors.length) throw new AggregateError(errors, `${errors.length} email(s) failed`);
	}

	public async close() {
		this.transport.close();
	}
}
