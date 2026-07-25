try {
    console.log("=== Checking Native Modules ===");
    console.log("Node version:", process.version);
    console.log("Platform:", process.platform);
    console.log("Arch:", process.arch);

    console.log("\n1. Testing @napi-rs/canvas...");
    const canvas = require("@napi-rs/canvas");
    console.log("✅ @napi-rs/canvas loaded successfully!");
    console.log("Available exports:", Object.keys(canvas));
    
    console.log("\n2. Testing @resvg/resvg-js...");
    const resvg = require("@resvg/resvg-js");
    console.log("✅ @resvg/resvg-js loaded successfully!");
    
    console.log("\n3. Testing jimp...");
    const jimp = require("jimp");
    console.log("✅ jimp loaded successfully!");

    console.log("\n🎉 All image processing dependencies loaded successfully!");
} catch (err) {
    console.error("\n❌ Error loading native modules:");
    console.error(err);
    
    console.log("\n💡 Why did this happen?");
    console.log("This usually happens because @napi-rs/canvas and @resvg/resvg-js use native compiled binaries.");
    console.log("If you copy-pasted the 'node_modules' folder from your Windows PC (or from a zip containing Windows files) to your Linux hosting server, the Windows native files (.node) cannot run on Linux.");
    
    console.log("\n🛠️ How to fix on your hosting server:");
    console.log("1. Connect to your hosting server console/terminal.");
    console.log("2. Run: rm -rf node_modules package-lock.json");
    console.log("   (Or delete the 'node_modules' folder and 'package-lock.json' file manually from the hosting panel).");
    console.log("3. Run: npm install");
    console.log("   (This will rebuild/download the correct Linux-compatible binaries for your hosting).");
    console.log("\nIf you are on Alpine Linux (e.g. inside a Docker/Pterodactyl container) and standard installation fails, try running:");
    console.log("   npm install @napi-rs/canvas-linux-x64-musl");
}
