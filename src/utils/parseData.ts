import { parse } from "csv-parse";
import { readFileSync } from "fs";

/**
 * Parses the csv file and returns an array of objects containing name and email
 * @param parserFn The function to parse the data
 */
export async function parseData(parserFn: (data: Record<string, string>) => ParsedData) {
	const csv = readFileSync(process.env.CSV_FILE);
	return new Promise<Record<string, string>[]>((resolve, reject) => {
		parse(csv, { columns: true }, (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	}).then((data) => data.map(parserFn).map(({ name, email }) => ({ name: parseName(name), email })));
}

/**
 * Parses the full name into a proper name
 * @param fullName The full name to be parsed
 */
export function parseName(fullName: string): string {
	const name = fullName.split(" ");
	if (name.length > 2) {
		const firstName = name[0].charAt(0).toUpperCase() + name[0].slice(1).toLowerCase();
		const lastName = name[name.length - 1].charAt(0).toUpperCase() + name[name.length - 1].slice(1).toLowerCase();
		return firstName + " " + lastName;
	}
	return name.map((n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()).join(" ");
}

export interface ParsedData {
	name: string;
	email: string;
}
