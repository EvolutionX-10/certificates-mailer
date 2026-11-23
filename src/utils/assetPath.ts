import { createHash } from "node:crypto";
import { join } from "node:path";
import { requiredEnv } from "./config.ts";

export function assetPath(email: string, type: "img" | "pdf"): string {
	const identifier = createHash("sha256").update(email.trim()).digest("hex");
	return join(
		requiredEnv(type === "pdf" ? "OUTPUT_PDF" : "OUTPUT_IMG"),
		`${identifier}.${type === "pdf" ? "pdf" : "png"}`,
	);
}
