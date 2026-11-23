import { Client } from "@utils";

const client = new Client({
	parserFn: (d) => ({ name: d["Name"], email: d["Email"] }),
});

try {
	// Enable only after reviewing generated certificates and the test email.
	// await client.setTestMode(false);

	await client.generateAssets("pdf");
	await client.sendBulk({}, true);
} finally {
	await client.close();
}
