import sharp from "sharp";
import { dirname } from "node:path";
import { FileUtil } from "./fileUtil.ts";
import { fontSize, requiredEnv } from "./config.ts";

export async function obtainDimensions(input: Buffer | string) {
	const { height, width } = await sharp(input).metadata();
	if (!height || !width) throw new Error("Cannot determine base image dimensions");
	return { height, width };
}

function escapeXML(text: string): string {
	return text.replace(
		/[&<>"']/g,
		(character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!,
	);
}

/** Render a name on a PNG certificate. FONT must be available to the system. */
export async function genImg(output: string, text: string) {
	const base = requiredEnv("BASE_IMG");
	const { height, width } = await obtainDimensions(base);
	const svgImage = Buffer.from(`
		<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
			<text x="50%" y="55%" text-anchor="middle" font-family="${escapeXML(requiredEnv("FONT"))}"
				font-size="${fontSize()}" fill="#5d6167">${escapeXML(text)}</text>
		</svg>`);
	FileUtil.ensureDir(dirname(output));
	await sharp(base)
		.composite([{ input: svgImage }])
		.toFile(output);
}
