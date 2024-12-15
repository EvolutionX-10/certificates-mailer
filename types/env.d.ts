declare module "bun" {
	interface Env {
		HOST: string;
		USER: string;
		PASS: string;
		FROM: string;
		SUBJECT: string;
		CSV_FILE: string;
		TEMPLATE_FILE: string;
		// Asset Generation
		BASE_IMG: string;
		BASE_PDF: string;
		OUTPUT_IMG: string;
		OUTPUT_PDF: string;
		FONT: string;
		FONT_SIZE: string;
		// Test User
		TEST_NAME: string;
		TEST_EMAIL: string;
	}
}
