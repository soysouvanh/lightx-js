import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render_users_profile } from "./out/tmplx_generated.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const outputPath = resolve(__dirname, "out/profile.html");
mkdirSync(dirname(outputPath), { recursive: true });
const outputStream = createWriteStream(outputPath);

const mockData = {
    user: {
        name: "<script>alert('XSS Hack')</script> John Doe",
        isAdmin: true,
        rights: ["READ", "WRITE", "DELETE"],
        bioHtml: "<strong>Super trusted</strong> HTML content."
    }
};

// Zero-allocation streaming invocation !
render_users_profile(outputStream, mockData);

outputStream.on("finish", () => {
    console.log(`HTML file successfully streamed to ${outputPath}`);
});

outputStream.end();
