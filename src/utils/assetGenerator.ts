import { greenBright } from "colorette";
import { genImg } from "./genImg.ts";
import { genPDF } from "./genPDF.ts";
import type { ParsedData } from "./parseData.ts";

export class AssetGenerator {
	public static async generateImg(path: string, text: string) {
		await genImg(path, text);
	}

	public static async generatePdf(path: string, text: string) {
		await genPDF(path, text);
	}

	/**
	 * Generates Assets to be sent with Email
	 * @param type What type should the asset be of?
	 * @param data Parsed Data
	 * @param test Whether you want to see random samples first
	 */
	public static async generateAsset(type: "img" | "pdf" | "both", data: ParsedData[], test = true) {
		if (test) {
			data = this.getTestData(data);
		}
		let promises = [];
		switch (type) {
			case "img":
				promises = [];
				for (const d of data) {
					const identifier = d.email.split("@")[0];
					promises.push(genImg(`${process.env.OUTPUT_IMG}${identifier}.png`, d.name));
					console.log(`${greenBright("[SUCCESS]")} Generated image for ${d.name}`);
				}
				await Promise.all(promises);
				break;
			case "pdf":
				promises = [];
				for (const d of data) {
					const identifier = d.email.split("@")[0];
					promises.push(genPDF(`${process.env.OUTPUT_PDF}${identifier}.pdf`, d.name));
					console.log(`${greenBright("[SUCCESS]")} Generated pdf for ${d.name}`);
				}
				await Promise.all(promises);
				break;
			case "both":
				promises = [];
				for (const d of data) {
					const identifier = d.email.split("@")[0];
					promises.push(genImg(`${process.env.OUTPUT_IMG}${identifier}.png`, d.name));
					promises.push(genPDF(`${process.env.OUTPUT_PDF}${identifier}.pdf`, d.name));
					console.log(`${greenBright("[SUCCESS]")} Generated image and pdf for ${d.name}`);
				}
				await Promise.all(promises);
				break;
		}
	}

	private static getTestData(data: ParsedData[]): ParsedData[] {
		data = data.sort(() => Math.random() - Math.random()).slice(0, 3);
		if (!data.some((r) => r.name === process.env.TEST_NAME)) {
			data.push({ name: process.env.TEST_NAME, email: process.env.TEST_EMAIL });
		}
		return data;
	}
}
