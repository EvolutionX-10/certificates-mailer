import { greenBright } from "colorette";
import { genImg } from "./genImg.ts";
import { genPDF } from "./genPDF.ts";
import { validateRecipient, type ParsedData } from "./parseData.ts";
import { assetPath } from "./assetPath.ts";
import { requiredEnv } from "./config.ts";

export class AssetGenerator {
	public static async generateImg(path: string, text: string) {
		await genImg(path, text);
	}

	public static async generatePdf(path: string, text: string) {
		await genPDF(path, text);
	}

	/** Generate one recipient at a time to keep memory bounded for large CSVs. */
	public static async generateAsset(type: "img" | "pdf" | "both", data: ParsedData[], test = true) {
		if (test) data = this.getTestData(data);
		for (const recipient of data) {
			if (type === "img" || type === "both") await genImg(assetPath(recipient.email, "img"), recipient.name);
			if (type === "pdf" || type === "both") await genPDF(assetPath(recipient.email, "pdf"), recipient.name);
			console.log(`${greenBright("[SUCCESS]")} Generated ${type} for ${recipient.name}`);
		}
	}

	private static getTestData(data: ParsedData[]): ParsedData[] {
		const recipient = validateRecipient({ name: requiredEnv("TEST_NAME"), email: requiredEnv("TEST_EMAIL") });
		const samples = [...data]
			.sort(() => Math.random() - 0.5)
			.filter((d) => d.email !== recipient.email)
			.slice(0, 3);
		return [...samples, recipient];
	}
}
