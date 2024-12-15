import { Client } from "@utils";

const client = new Client({
	parserFn: (d) => ({ name: d["Name"], email: d["Email"] }),
});

// ! ENABLE THIS WHEN YOU ARE READY TO SEND EMAILS
// await client.setTestMode(false);

await client.generateAssets("pdf");
await client.sendBulk({}, true);

await client.close();
