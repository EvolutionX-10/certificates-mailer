export {};

declare module "bun" {
	interface Env {
		SMTP_HOST?: string;
		SMTP_PORT?: string;
		SMTP_SECURE?: string;
		SMTP_USER?: string;
		SMTP_PASS?: string;
		FROM?: string;
		SUBJECT?: string;
		CSV_FILE?: string;
		TEMPLATE_FILE?: string;
		BASE_IMG?: string;
		BASE_PDF?: string;
		OUTPUT_IMG?: string;
		OUTPUT_PDF?: string;
		FONT?: string;
		FONT_SIZE?: string;
		TEST_NAME?: string;
		TEST_EMAIL?: string;
		STATS_DIR?: string;
	}
}
