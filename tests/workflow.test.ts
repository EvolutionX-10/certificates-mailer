import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTransport } from "nodemailer";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { Client } from "../src/utils/client.ts";
import { parseData, parseName } from "../src/utils/parseData.ts";
import { assetPath } from "../src/utils/assetPath.ts";
import { genImg } from "../src/utils/genImg.ts";
import { fontSize } from "../src/utils/config.ts";

const originalCwd = process.cwd();
const originalEnv = { ...process.env };
const parserFn = (row: Record<string, string>) => ({ name: row.Name, email: row.Email });
let directory: string;
let client: Client | undefined;

beforeEach(async () => {
	directory = mkdtempSync(join(tmpdir(), "certificates-mailer-"));
	process.chdir(directory);
	Object.assign(process.env, {
		SMTP_HOST: "smtp.example.invalid",
		SMTP_PORT: "587",
		SMTP_SECURE: "",
		SMTP_USER: "test",
		SMTP_PASS: "test",
		FROM: "sender@example.invalid",
		SUBJECT: "Certificate",
		CSV_FILE: "data.csv",
		TEMPLATE_FILE: "template.html",
		BASE_PDF: "base.pdf",
		BASE_IMG: "base.png",
		OUTPUT_PDF: "custom/nested/pdf",
		OUTPUT_IMG: "custom/nested/image",
		STATS_DIR: "stats",
		FONT: "Helvetica",
		FONT_SIZE: "20",
		TEST_NAME: "Test Person",
		TEST_EMAIL: "test@example.invalid",
	});
	writeFileSync("data.csv", "Name,Email\nTest Person,alice@example.invalid\nSecond Person,alice@other.invalid\n");
	writeFileSync("template.html", "<p>Hello {{name}}, {{event}}</p>");
	const pdf = await PDFDocument.create();
	pdf.addPage([600, 400]);
	writeFileSync("base.pdf", await pdf.save());
	await sharp({ create: { width: 600, height: 400, channels: 3, background: "white" } })
		.png()
		.toFile("base.png");
});

afterEach(async () => {
	await client?.close();
	client = undefined;
	process.chdir(originalCwd);
	rmSync(directory, { recursive: true, force: true });
	for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
	Object.assign(process.env, originalEnv);
});

/** Collect the actual MIME stream, including file attachments, without a network connection. */
function captureMail(failures = new Set<string>()) {
	const messages: { to: string; mime: string }[] = [];
	client = new Client({ parserFn });
	client.transport.close();
	client.transport = createTransport({
		name: "local-test",
		version: "1.0.0",
		send(mail, callback) {
			const to = mail.message.getEnvelope().to[0];
			const info = {
				envelope: { from: "sender@example.invalid", to: [to] },
				messageId: "local-test",
				accepted: [to],
				rejected: [],
			};
			if (failures.has(to)) return callback(new Error("Simulated SMTP rejection"), info);
			const chunks: Buffer[] = [];
			const stream = mail.message.createReadStream();
			stream.on("data", (chunk: Buffer) => chunks.push(chunk));
			stream.on("error", (error) => callback(error, info));
			stream.on("end", () => {
				messages.push({ to, mime: Buffer.concat(chunks).toString() });
				callback(null, info);
			});
		},
	});
	return messages;
}

test("CSV handles BOM, blank rows, and whitespace while preserving full names", async () => {
	writeFileSync("data.csv", '\uFEFFName,Email\n"  Alex de McDonald  ", alex@example.invalid\n\n');
	expect(await parseData(parserFn)).toEqual([{ name: "Alex de McDonald", email: "alex@example.invalid" }]);
	expect(parseName("  Alex   de McDonald  ")).toBe("Alex de McDonald");
});

test("CSV fails before sending for missing columns, invalid addresses, duplicates, and empty input", async () => {
	for (const csv of [
		"Wrong,Email\nAlex,alex@example.invalid\n",
		"Name,Email\nAlex,invalid\n",
		'Name,Email\nAlex,"alice,bob@example.invalid"\n',
		"Name,Email\nAlex,alice..bob@example.invalid\n",
		"Name,Email\nAlex,alex@example.invalid\nAlex Again,alex@example.invalid\n",
		"Name,Email\n",
	]) {
		writeFileSync("data.csv", csv);
		await expect(parseData(parserFn)).rejects.toThrow();
	}
});

test("test workflow generates distinct PDFs and sends only TEST_EMAIL with the configured attachment", async () => {
	const messages = captureMail();
	await client!.generateAssets("pdf");
	const first = assetPath("alice@example.invalid", "pdf");
	const second = assetPath("alice@other.invalid", "pdf");
	expect(first).not.toBe(second);
	for (const path of [first, second, assetPath(process.env.TEST_EMAIL!, "pdf")]) {
		expect((await PDFDocument.load(readFileSync(path))).getPageCount()).toBe(1);
	}
	expect(readFileSync(first).equals(readFileSync(second))).toBe(false);
	await client!.sendBulk({ event: "Local & Safe" }, true);
	expect(messages).toHaveLength(1);
	expect(messages[0].to).toBe("test@example.invalid");
	expect(messages[0].mime).toContain("Hello Test, Local &amp; Safe");
	expect(messages[0].mime).toContain("application/pdf");
	expect(readFileSync("stats/test-accepted.txt", "utf8")).toBe("test@example.invalid\n");
	expect(existsSync("stats/accepted.txt")).toBe(false);
	await expect(client!.send({ name: "Other", email: "other@example.invalid" }, "Hello")).rejects.toThrow("Test mode");
});

test("live workflow creates stats on first run, continues after rejection, rejects overall, and skips accepted on retry", async () => {
	const failures = new Set(["alice@example.invalid"]);
	const messages = captureMail(failures);
	// Bypass only the interactive five-second warning in this isolated offline test.
	client!.testMode = false;
	await client!.generateAssets("pdf");
	writeFileSync("data.csv", "Changed,Invalid\ninput,after-generation\n");
	await expect(client!.sendBulk({}, true)).rejects.toThrow("1 email(s) failed");
	expect(messages.map((m) => m.to)).toEqual(["alice@other.invalid"]);
	expect(readFileSync("stats/accepted.txt", "utf8")).toBe("alice@other.invalid\n");
	expect(readFileSync("stats/rejected.txt", "utf8")).toBe("alice@example.invalid\n");
	failures.clear();
	await client!.sendBulk({}, true);
	expect(messages.map((m) => m.to)).toEqual(["alice@other.invalid", "alice@example.invalid"]);
});

test("missing attachment rejects and does not record acceptance", async () => {
	captureMail();
	await expect(client!.sendBulk({}, true)).rejects.toThrow();
	expect(existsSync("stats/test-accepted.txt")).toBe(false);
	expect(readFileSync("stats/test-rejected.txt", "utf8")).toBe("test@example.invalid\n");
});

test("image generation renders XML-sensitive names into nested output paths", async () => {
	process.env.FONT = "sans-serif";
	await genImg("nested/image/certificate.png", 'Alex & <Friends> "O\'Brien"');
	const result = sharp("nested/image/certificate.png");
	expect((await result.metadata()).width).toBe(600);
	const { channels } = await result.stats();
	expect(channels.some((channel) => channel.min < 255)).toBe(true);
});

test("SMTP settings require explicit credentials and use modern TLS defaults", () => {
	client = new Client({ parserFn });
	expect(client.transport.options).toMatchObject({ port: 587, secure: false, requireTLS: true });
	client.transport.close();
	process.env.SMTP_PORT = "465";
	client = new Client({ parserFn });
	expect(client.transport.options).toMatchObject({ port: 465, secure: true, requireTLS: false });
	client.transport.close();
	process.env.SMTP_PORT = "2465";
	process.env.SMTP_SECURE = "true";
	process.env.SMTP_PASS = "  secret with spaces  ";
	client = new Client({ parserFn });
	expect(client.transport.options).toMatchObject({
		port: 2465,
		secure: true,
		auth: { pass: "  secret with spaces  " },
	});
	process.env.SMTP_SECURE = "invalid";
	expect(() => new Client({ parserFn })).toThrow("SMTP_SECURE");
	process.env.SMTP_SECURE = "";
	delete process.env.SMTP_USER;
	process.env.USER = "shell-user";
	expect(() => new Client({ parserFn })).toThrow("SMTP_USER");
	process.env.SMTP_PORT = "invalid";
	expect(() => new Client({ parserFn })).toThrow("SMTP_PORT");
});

test("invalid font sizes fail clearly", () => {
	for (const value of ["", "0", "NaN", "-1"]) {
		process.env.FONT_SIZE = value;
		expect(fontSize).toThrow();
	}
});
