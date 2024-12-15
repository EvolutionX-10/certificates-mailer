import { createTransport, Transporter } from "nodemailer";
import { compile } from "handlebars";
import { greenBright, redBright, yellowBright } from "colorette";
import { Stopwatch } from "@sapphire/stopwatch";
import { parseData, ParsedData } from "./parseData.ts";
import { FileUtil } from "./fileUtil.ts";
import { AssetGenerator } from "./assetGenerator.ts";

export class Client {
	public transport: Transporter;
	public testMode = true;
	public data: ParsedData[];
	public parserFn: (data: Record<string, string>) => ParsedData;

	public constructor({ parserFn }: { parserFn: (data: Record<string, string>) => ParsedData }) {
		this.transport = createTransport({
			host: process.env.HOST,
			pool: true,
			auth: {
				user: process.env.USER,
				pass: process.env.PASS,
			},
			tls: {
				ciphers: "SSLv3",
			},
		});
		this.parserFn = parserFn;
	}

	public async setTestMode(mode: boolean) {
		if (mode === false) {
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
		await AssetGenerator.generateAsset(type, this.data, this.testMode);
		console.log(`${greenBright("[INFO]")} Asset Generation Time taken: ${watch.stop()}`);
	}

	/**
	 * Sends an email to the given email address
	 * @param data The data to be sent
	 * @param body The body of the email
	 * @param attachment Whether to attach the PDF or not
	 */
	public async send<T extends string | Record<string, string> = string>(data: ParsedData, body: T, attachment = false) {
		if (!process.env.SUBJECT) throw new Error("Subject not set");

		const identifier = data.email.split("@")[0];

		return this.transport
			.sendMail({
				from: process.env.FROM,
				to: data.email,
				subject: process.env.SUBJECT,
				html: typeof body === "string" ? body : compile(FileUtil.read(process.env.TEMPLATE_FILE))(body),
				attachments: attachment
					? [
							{
								filename: `${data.name}.pdf`,
								contentType: "application/pdf",
								path: `./pdf/${identifier}.pdf`,
							},
					  ]
					: [],
			})
			.then((d) => {
				if (d.accepted.length > 0) {
					FileUtil.append("./stats/accepted.txt", data.email + "\n");
					console.log(`${greenBright("[SUCCESS]")} ${data.email}`);
				} else if (d.rejected.length > 0) {
					FileUtil.append("./stats/rejected.txt", data.email + "\n");
					console.log(`${redBright("[FAILED]")} ${data.email}`);
				}
			})
			.catch((e) => {
				FileUtil.append("./stats/rejected.txt", data.email + "\n");
				console.log(`${redBright("[FAILED]")} ${data.email}`);
				console.log(e);
			});
	}

	/**
	 * Bulk sends emails to the given data
	 * @param body Extra data to be passed in body (like attributes to be parsed in email content)
	 * @param attachment Attachments to be sent or not
	 * @example
	 * ```ts
	 * await client.sendBulk({ event: "Hello World" }, true);
	 * ```
	 */
	public async sendBulk(body?: Record<string, string>, attachment = false) {
		await this.getData();
		const watch = new Stopwatch();
		if (this.testMode) {
			await this.send(
				{
					name: process.env.TEST_NAME,
					email: process.env.TEST_EMAIL,
				},
				{ name: process.env.TEST_NAME.split(" ")[0], ...body },
				attachment
			);
			console.log(`${greenBright("[INFO]")} Test Emailing Time taken: ${watch.stop()}`);
			return;
		}

		const accepted = FileUtil.read("./stats/accepted.txt").split("\n");
		const promises = [];
		for (let i = 0; i < this.data.length; i++) {
			if (!accepted.includes(this.data[i].email)) {
				promises.push(
					this.send(
						this.data[i],
						{
							name: this.data[i].name.split(" ")[0],
							...body,
						},
						attachment
					)
				);
			} else {
				console.log(`${yellowBright("[SKIPPED]")} ${this.data[i].email}`);
			}
		}
		await Promise.all(promises);
		await this.close();
		console.log(`${greenBright("[INFO]")} Emailing Time taken: ${watch.stop()}`);
	}

	/**
	 * Closes the connection to the email server
	 */
	public async close() {
		return this.transport.close();
	}
}
