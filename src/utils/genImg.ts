import sharp from "sharp";
import { FileUtil } from "./fileUtil.ts";

export async function obtainDimensions(input: Buffer | string) {
	const { height, width } = await sharp(input).metadata();
	return { height, width };
}

/**
 * Generates an image file with the given text written on it
 * @param output Output image path
 * @param text Text to be written on the image
 */
export async function genImg(output: string, text: string) {
	FileUtil.ensureDir(process.env.OUTPUT_IMG);
	const { height, width } = await obtainDimensions(process.env.BASE_IMG);
	const l = (text.length * +process.env.FONT_SIZE) / 4;

	const svgImage = Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .title {
            font-family: ${process.env.FONT}, sans-serif;
            font-size: ${process.env.FONT_SIZE}px;
            fill: #5d6167;
        }
      </style>
      <text x="50%" y="55%" dx="${-l}" class="title">${text}</text>
    </svg>`);

	await sharp(process.env.BASE_IMG)
		.composite([{ input: svgImage }])
		.toFile(output);
}
