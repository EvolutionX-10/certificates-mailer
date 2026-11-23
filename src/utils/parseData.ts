import { parse } from "csv-parse";
import { readFileSync } from "node:fs";
import { requiredEnv } from "./config.ts";

export interface ParsedData {
	name: string;
	email: string;
}

export function validateRecipient(data: ParsedData): ParsedData {
	const name = typeof data.name === "string" ? parseName(data.name) : "";
	const email = typeof data.email === "string" ? data.email.trim() : "";
	// Accept a single bare mailbox, never display-name or address-list syntax.
	const mailbox =
		/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
	const local = email.split("@")[0];
	if (!name || !mailbox.test(email) || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
		throw new Error("Each recipient must have a name and a valid email address; check CSV headers and test settings");
	}
	return { name, email };
}

/** Validate the entire CSV before generating certificates or sending mail. */
export async function parseData(parserFn: (data: Record<string, string>) => ParsedData): Promise<ParsedData[]> {
	const csv = readFileSync(requiredEnv("CSV_FILE"));
	const rows = await new Promise<Record<string, string>[]>((resolve, reject) => {
		parse<Record<string, string>>(
			csv,
			{ columns: true, bom: true, skip_empty_lines: true, trim: true },
			(err, data) => {
				if (err) reject(err);
				else resolve(data);
			},
		);
	});
	const recipients = rows.map((row) => validateRecipient(parserFn(row)));
	if (!recipients.length) throw new Error("CSV contains no recipients");
	const seen = new Set<string>();
	for (const { email } of recipients) {
		if (seen.has(email)) throw new Error(`Duplicate recipient in CSV: ${email}`);
		seen.add(email);
	}
	return recipients;
}

/** Preserve the supplied spelling and all name components. */
export function parseName(fullName: string): string {
	return fullName.trim().replace(/\s+/g, " ");
}
