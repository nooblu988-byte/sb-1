const fs = require("fs");
const path = require("path");

async function run() {
    try {
        console.log("Downloading test avatar...");
        const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
        const res = await fetch("https://cdn.discordapp.com/embed/avatars/0.png");
        if (!res.ok) throw new Error("Fetch failed");
        const buffer = await res.buffer();
        
        console.log("Applying PFP effects...");
        const { applyPfpEffects } = require("./src/utils/imageEffects");
        const processed = await applyPfpEffects(buffer);
        
        fs.writeFileSync("test_glow.png", processed);
        console.log("✅ Success! Processed image saved as 'test_glow.png'");
    } catch (err) {
        console.error("❌ Error applying effects:", err);
    }
}

run();
