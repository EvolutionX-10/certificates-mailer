import { Color, PDFDocument, rgb } from "pdf-lib";
import fonts from "@pdf-lib/fontkit";
import { readFileSync, writeFileSync } from "fs";
import { FileUtil } from "./fileUtil.ts";

/**
 * Generates a PDF file with the given text written on it
 * @param output Output PDF file path
 * @param text Text to be written on the PDF
 */
export async function genPDF(output: string, text: string) {
	FileUtil.ensureDir(process.env.OUTPUT_PDF);
	const font = readFileSync(`./assets/${process.env.FONT}.ttf`);

	const pdfDoc = await PDFDocument.load(readFileSync(process.env.BASE_PDF));
	pdfDoc.registerFontkit(fonts);

	const pages = pdfDoc.getPages();
	const firstPage = pages[0];
	const fontSize = +process.env.FONT_SIZE;

	firstPage.drawText(text, {
		x: firstPage.getWidth() / 2 - (text.length * fontSize) / 4,
		y: firstPage.getHeight() / 2 + fontSize / 2,
		size: fontSize,
		font: await pdfDoc.embedFont(font, { subset: true }),
		color: wrapRGB(93, 97, 103),
	});

	const pdfBytes = await pdfDoc.save();
	writeFileSync(output, pdfBytes);
}

/**
 * Wraps the RGB values into a Color object
 * @param r Red value
 * @param g Green value
 * @param b Blue value
 */
function wrapRGB(r: number, g: number, b: number): Color {
	return rgb(r / 255, g / 255, b / 255);
}
