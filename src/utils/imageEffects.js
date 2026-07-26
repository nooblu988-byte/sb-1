const { createCanvas, loadImage } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

/**
 * Draws a star on the canvas context with a soft glow.
 */
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = color;
    
    // Very soft, simple and light glow (comfortable for the eyes)
    ctx.shadowBlur = 4;
    if (color === "#FFD700") {
        ctx.shadowColor = "rgba(255, 215, 0, 0.35)";
    } else if (color === "#FFFFFF") {
        ctx.shadowColor = "rgba(255, 255, 255, 0.35)";
    } else {
        ctx.shadowColor = color;
    }
    ctx.fill();
    ctx.shadowBlur = 0; // reset
}

/**
 * Preprocesses and loads a profile picture buffer, handling SVG conversions and Jimp fallbacks.
 * @param {Buffer} pfpBuffer - The raw image buffer.
 * @returns {Promise<Image>} - The loaded image object.
 */
async function loadPfpImage(pfpBuffer) {
    let finalBuffer = pfpBuffer;

    // Detect if the buffer is actually an SVG image
    const strHeader = pfpBuffer.toString("utf8", 0, 200).trim();
    const isSvg = /^\s*(<svg|<\?xml)/i.test(strHeader);

    if (isSvg) {
        try {
            const { Resvg } = require("@resvg/resvg-js");
            const resvg = new Resvg(pfpBuffer);
            finalBuffer = Buffer.from(resvg.render().asPng());
        } catch (err) {
            console.error("resvg-js failed to render SVG, attempting direct load:", err);
        }
    }

    // Load the PFP image with fallback to Jimp for self-adjustment
    let img;
    try {
        img = await loadImage(finalBuffer);
    } catch (err) {
        console.error("loadImage failed natively, attempting pure-JS conversion with Jimp:", err.message);
        try {
            let Jimp = require("jimp");
            if (Jimp.Jimp) Jimp = Jimp.Jimp;
            const image = await Jimp.read(finalBuffer);
            finalBuffer = await image.getBufferAsync(Jimp.MIME_PNG || "image/png");
            img = await loadImage(finalBuffer);
            console.log("Successfully converted image to PNG using Jimp!");
        } catch (jimpErr) {
            console.error("Jimp conversion also failed:", jimpErr.message);
            throw err; // rethrow original Skia error if Jimp fails
        }
    }
    return img;
}

/**
 * Applies shining stars/sparkles around the PFP without modifying or resizing it.
 * @param {Buffer} pfpBuffer - The original image buffer.
 * @param {boolean} isDuo - Whether this is a duo participant.
 * @returns {Promise<Buffer>} - The processed image buffer.
 */
async function applyPfpEffects(pfpBuffer, isDuo = false) {
    const img = await loadPfpImage(pfpBuffer);

    const W = img.width;
    const H = img.height;
    const isPortrait = H > W;

    // Pad the canvas by 50px on each side to leave comfortable room for stars
    const padding = 50;
    const canvasW = W + padding * 2;
    const canvasH = H + padding * 2;

    // Create canvas
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext("2d");

    // Clear background (transparent)
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Draw the original image exactly as is, without cropping or rounded corners
    ctx.drawImage(img, padding, padding, W, H);

    // Glowing shining stars sizing
    const baseStarSize = Math.max(4, Math.floor(Math.min(W, H) * 0.025)); // Proportionate star size
    const lgStarOuter = baseStarSize * 1.4;
    const lgStarInner = lgStarOuter * 0.4;
    const smStarOuter = baseStarSize * 0.6;
    const smStarInner = smStarOuter * 0.35;

    // Distance of stars from the image border (outside boundary)
    const distance = 22;
    const cornerDistance = 16;
    const shadowDistance = 12;

    // Left Middle (Gold)
    drawStar(ctx, padding - distance, padding + H / 2, 4, lgStarOuter, lgStarInner, "#FFD700");
    // Right Middle (White)
    drawStar(ctx, padding + W + distance, padding + H / 2, 4, lgStarOuter, lgStarInner, "#FFFFFF");

    // Corners (Floating outside diagonally)
    // Top-Left (Large White)
    drawStar(ctx, padding - cornerDistance, padding - cornerDistance, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFFFFF");
    // Top-Right (Large Gold)
    drawStar(ctx, padding + W + cornerDistance, padding - cornerDistance, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFD700");
    // Bottom-Left (Large Gold)
    drawStar(ctx, padding - cornerDistance, padding + H + cornerDistance, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFD700");
    // Bottom-Right (Large White)
    drawStar(ctx, padding + W + cornerDistance, padding + H + cornerDistance, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFFFFF");

    // Left/Right sparkles
    drawStar(ctx, padding - shadowDistance, padding + H * 0.3, 4, smStarOuter, smStarInner, "#FFFFFF");
    drawStar(ctx, padding - shadowDistance, padding + H * 0.7, 4, smStarOuter, smStarInner, "#FFD700");
    drawStar(ctx, padding + W + shadowDistance, padding + H * 0.3, 4, smStarOuter, smStarInner, "#FFD700");
    drawStar(ctx, padding + W + shadowDistance, padding + H * 0.7, 4, smStarOuter, smStarInner, "#FFFFFF");

    if (!isDuo) {
        // Top Middle (Gold)
        drawStar(ctx, padding + W / 2, padding - distance, 4, lgStarOuter, lgStarInner, "#FFD700");
        // Bottom Middle (White)
        drawStar(ctx, padding + W / 2, padding + H + distance, 4, lgStarOuter, lgStarInner, "#FFFFFF");

        // Top/Bottom sparkles
        drawStar(ctx, padding + W * 0.3, padding - shadowDistance, 4, smStarOuter, smStarInner, "#FFFFFF");
        drawStar(ctx, padding + W * 0.7, padding - shadowDistance, 4, smStarOuter, smStarInner, "#FFD700");
        drawStar(ctx, padding + W * 0.3, padding + H + shadowDistance, 4, smStarOuter, smStarInner, "#FFD700");
        drawStar(ctx, padding + W * 0.7, padding + H + shadowDistance, 4, smStarOuter, smStarInner, "#FFFFFF");
    }

    // Return buffer
    return canvas.toBuffer("image/png");
}

/**
 * Merges two profile pictures side-by-side without borders, background boxes, or modifications.
 * @param {Buffer} pfpBuffer1 - Teammate 1's profile picture buffer.
 * @param {Buffer} pfpBuffer2 - Teammate 2's profile picture buffer.
 * @returns {Promise<Buffer>} - The merged and styled image buffer.
 */
async function applyDuoPfpEffects(pfpBuffer1, pfpBuffer2) {
    const img1 = await loadPfpImage(pfpBuffer1);
    const img2 = await loadPfpImage(pfpBuffer2);

    const W = 512;
    const H = 512;
    const gap = 24;

    const combinedW = W * 2 + gap;
    const combinedH = H;

    const padding = 50;
    const canvasW = combinedW + padding * 2;
    const canvasH = combinedH + padding * 2;

    // Create combined canvas
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Draw both images exactly as they are without rounded corners or borders
    ctx.drawImage(img1, padding, padding, W, H);
    ctx.drawImage(img2, padding + W + gap, padding, W, H);

    // Glowing shining stars sizing
    const baseStarSize = Math.max(4, Math.floor(Math.min(W, H) * 0.025)); // Proportionate star size (approx 12)
    const lgStarOuter = baseStarSize * 1.4;
    const lgStarInner = lgStarOuter * 0.4;
    const smStarOuter = baseStarSize * 0.6;
    const smStarInner = smStarOuter * 0.35;

    const distance = 22;
    const cornerDistance = 16;
    const shadowDistance = 12;

    // Corners (Floating outside diagonally around the combined images boundary)
    // Top-Left (Large White)
    drawStar(ctx, padding - cornerDistance, padding - cornerDistance, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFFFFF");
    // Top-Right (Large Gold)
    drawStar(ctx, padding + combinedW + cornerDistance, padding - cornerDistance, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFD700");
    // Bottom-Left (Large Gold)
    drawStar(ctx, padding - cornerDistance, padding + combinedH + cornerDistance, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFD700");
    // Bottom-Right (Large White)
    drawStar(ctx, padding + combinedW + cornerDistance, padding + combinedH + cornerDistance, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFFFFF");

    // Middle Edges
    // Left Middle (Gold)
    drawStar(ctx, padding - distance, padding + combinedH / 2, 4, lgStarOuter, lgStarInner, "#FFD700");
    // Right Middle (White)
    drawStar(ctx, padding + combinedW + distance, padding + combinedH / 2, 4, lgStarOuter, lgStarInner, "#FFFFFF");
    // Top Middle (Gold)
    drawStar(ctx, padding + combinedW / 2, padding - distance, 4, lgStarOuter, lgStarInner, "#FFD700");
    // Bottom Middle (White)
    drawStar(ctx, padding + combinedW / 2, padding + combinedH + distance, 4, lgStarOuter, lgStarInner, "#FFFFFF");

    // Sparkles
    drawStar(ctx, padding - shadowDistance, padding + combinedH * 0.3, 4, smStarOuter, smStarInner, "#FFFFFF");
    drawStar(ctx, padding - shadowDistance, padding + combinedH * 0.7, 4, smStarOuter, smStarInner, "#FFD700");
    drawStar(ctx, padding + combinedW + shadowDistance, padding + combinedH * 0.3, 4, smStarOuter, smStarInner, "#FFD700");
    drawStar(ctx, padding + combinedW + shadowDistance, padding + combinedH * 0.7, 4, smStarOuter, smStarInner, "#FFFFFF");

    // Top/Bottom sparkles on the border
    drawStar(ctx, padding + combinedW * 0.25, padding - shadowDistance, 4, smStarOuter, smStarInner, "#FFFFFF");
    drawStar(ctx, padding + combinedW * 0.75, padding - shadowDistance, 4, smStarOuter, smStarInner, "#FFD700");
    drawStar(ctx, padding + combinedW * 0.25, padding + combinedH + shadowDistance, 4, smStarOuter, smStarInner, "#FFD700");
    drawStar(ctx, padding + combinedW * 0.75, padding + combinedH + shadowDistance, 4, smStarOuter, smStarInner, "#FFFFFF");

    // Return buffer
    return canvas.toBuffer("image/png");
}

module.exports = { applyPfpEffects, applyDuoPfpEffects };
