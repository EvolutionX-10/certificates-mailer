import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fonts from "@pdf-lib/fontkit";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FileUtil } from "./fileUtil.ts";
import { fontSize, requiredEnv } from "./config.ts";

/** Render a name on the first page of a PDF certificate. */
export async function genPDF(output: string, text: string) {
	const pdfDoc = await PDFDocument.load(readFileSync(requiredEnv("BASE_PDF")));
	pdfDoc.registerFontkit(fonts);
	const fontName = requiredEnv("FONT");
	const font = Object.values(StandardFonts).includes(fontName as StandardFonts)
		? await pdfDoc.embedFont(fontName as StandardFonts)
		: await pdfDoc.embedFont(readFileSync(join("assets", `${fontName}.ttf`)), { subset: true });
	const firstPage = pdfDoc.getPages()[0];
	if (!firstPage) throw new Error("BASE_PDF must contain at least one page");
	const size = fontSize();
	firstPage.drawText(text, {
		x: (firstPage.getWidth() - font.widthOfTextAtSize(text, size)) / 2,
		y: firstPage.getHeight() / 2 + size / 2,
		size,
		font,
		color: rgb(93 / 255, 97 / 255, 103 / 255),
	});
	FileUtil.ensureDir(dirname(output));
	writeFileSync(output, await pdfDoc.save());
}
