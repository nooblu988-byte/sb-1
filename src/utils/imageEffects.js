const { createCanvas, loadImage } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

/**
 * Draws a star on the canvas context.
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
    ctx.shadowBlur = 12; // Intense glowing effect
    ctx.shadowColor = color;
    ctx.fill();
    ctx.shadowBlur = 0; // reset
}

/**
 * Draws a rounded rectangle path.
 */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
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
            const { Jimp } = require("jimp");
            const image = await Jimp.read(finalBuffer);
            finalBuffer = await image.getBuffer("image/png");
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
 * Applies a glowing border and shining stars/sparkles around the PFP.
 * @param {Buffer} pfpBuffer - The original image buffer.
 * @param {boolean} isDuo - Whether this is a duo participant.
 * @returns {Promise<Buffer>} - The processed image buffer.
 */
async function applyPfpEffects(pfpBuffer, isDuo = false) {
    const img = await loadPfpImage(pfpBuffer);

    const W = img.width;
    const H = img.height;
    const isPortrait = H > W;

    // We pad the canvas by 65px on each side (total 130px) to allow room for the outer border (18px offset) and star shadows
    const padding = 65;
    const canvasW = W + padding * 2;
    const canvasH = H + padding * 2;

    // Create canvas
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext("2d");

    // Clear background (transparent)
    ctx.clearRect(0, 0, canvasW, canvasH);

    const borderX = padding - 18; // Make it 18px outside the image (beautiful spacious gap)
    const borderY = padding - 18;
    const borderW = W + 36;
    const borderH = H + 36;
    const borderRadius = Math.max(16, Math.floor(Math.min(W, H) * 0.08) + 6);

    // Draw a soft, attractive glowing shadow behind the main box
    ctx.save();
    ctx.shadowColor = "rgba(255, 0, 127, 0.25)";
    ctx.shadowBlur = 15;
    roundRect(ctx, borderX, borderY, borderW, borderH, borderRadius);
    ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
    ctx.fill();
    ctx.restore();

    // Draw the clipped PFP
    ctx.save();
    const imageRadius = Math.max(8, borderRadius - 8);
    roundRect(ctx, padding, padding, W, H, imageRadius);
    ctx.clip();
    ctx.drawImage(img, padding, padding, W, H);
    ctx.restore();

    // Draw a soft neon gradient border with a strong neon glow around the outer boundary
    ctx.save();
    const grad = ctx.createLinearGradient(borderX, borderY, borderX + borderW, borderY + borderH);
    grad.addColorStop(0, "#FF007F");   // Neon Pink
    grad.addColorStop(0.33, "#7F00FF"); // Purple
    grad.addColorStop(0.66, "#00F0FF"); // Cyan
    grad.addColorStop(1, "#FFD700");   // Gold
    ctx.strokeStyle = grad;

    // Helper function to draw left and right borders separately (excluding top/bottom edges)
    function strokeBorder(ctx) {
        if (isDuo) {
            // Draw left side border path (top-left rounded corner, left line, bottom-left rounded corner)
            ctx.beginPath();
            ctx.moveTo(borderX + borderRadius, borderY);
            ctx.quadraticCurveTo(borderX, borderY, borderX, borderY + borderRadius);
            ctx.lineTo(borderX, borderY + borderH - borderRadius);
            ctx.quadraticCurveTo(borderX, borderY + borderH, borderX + borderRadius, borderY + borderH);
            ctx.stroke();

            // Draw right side border path (top-right rounded corner, right line, bottom-right rounded corner)
            ctx.beginPath();
            ctx.moveTo(borderX + borderW - borderRadius, borderY);
            ctx.quadraticCurveTo(borderX + borderW, borderY, borderX + borderW, borderY + borderRadius);
            ctx.lineTo(borderX + borderW, borderY + borderH - borderRadius);
            ctx.quadraticCurveTo(borderX + borderW, borderY + borderH, borderX + borderW - borderRadius, borderY + borderH);
            ctx.stroke();
        } else {
            roundRect(ctx, borderX, borderY, borderW, borderH, borderRadius);
            ctx.stroke();
        }
    }

    // Draw first pass with a wide, soft cyan/purple glow
    ctx.shadowColor = "rgba(0, 240, 255, 0.6)";
    ctx.shadowBlur = 25;
    ctx.lineWidth = 6;
    strokeBorder(ctx);

    // Draw second pass with a tight, hot pink glow for a realistic neon core look
    ctx.shadowColor = "rgba(255, 0, 127, 0.85)";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 5;
    strokeBorder(ctx);

    // Draw third pass without glow to keep the gradient border sharp
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4;
    strokeBorder(ctx);

    ctx.restore();

    // Draw glowing shining stars on borders
    const baseStarSize = Math.max(4, Math.floor(Math.min(W, H) * 0.025)); // Proportionate star size
    const lgStarOuter = baseStarSize * 1.4;
    const lgStarInner = lgStarOuter * 0.4;
    const smStarOuter = baseStarSize * 0.6;
    const smStarInner = smStarOuter * 0.35;

    // Adapt star offsets dynamically to prevent clipping on compact portrait padding
    const starOffset = isPortrait ? 10 : 15;
    const cornerOffset = isPortrait ? 8 : 12;
    const shadowOffset = isPortrait ? 6 : 8;

    // Left Middle (Gold)
    drawStar(ctx, borderX - starOffset, borderY + borderH / 2, 4, lgStarOuter, lgStarInner, "#FFD700");
    // Right Middle (White)
    drawStar(ctx, borderX + borderW + starOffset, borderY + borderH / 2, 4, lgStarOuter, lgStarInner, "#FFFFFF");

    // Corners (Floating outside diagonally)
    // Top-Left (Large White)
    drawStar(ctx, borderX - cornerOffset, borderY - cornerOffset, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFFFFF");
    // Top-Right (Large Gold)
    drawStar(ctx, borderX + borderW + cornerOffset, borderY - cornerOffset, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFD700");
    // Bottom-Left (Large Gold)
    drawStar(ctx, borderX - cornerOffset, borderY + borderH + cornerOffset, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFD700");
    // Bottom-Right (Large White)
    drawStar(ctx, borderX + borderW + cornerOffset, borderY + borderH + cornerOffset, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFFFFF");

    // Left/Right sparkles
    drawStar(ctx, borderX - shadowOffset, borderY + borderH * 0.3, 4, smStarOuter, smStarInner, "#FFFFFF");
    drawStar(ctx, borderX - shadowOffset, borderY + borderH * 0.7, 4, smStarOuter, smStarInner, "#FFD700");
    drawStar(ctx, borderX + borderW + shadowOffset, borderY + borderH * 0.3, 4, smStarOuter, smStarInner, "#FFD700");
    drawStar(ctx, borderX + borderW + shadowOffset, borderY + borderH * 0.7, 4, smStarOuter, smStarInner, "#FFFFFF");

    if (!isDuo) {
        // Top Middle (Gold)
        drawStar(ctx, borderX + borderW / 2, borderY - starOffset, 4, lgStarOuter, lgStarInner, "#FFD700");
        // Bottom Middle (White)
        drawStar(ctx, borderX + borderW / 2, borderY + borderH + starOffset, 4, lgStarOuter, lgStarInner, "#FFFFFF");

        // Top/Bottom sparkles
        drawStar(ctx, borderX + borderW * 0.3, borderY - shadowOffset, 4, smStarOuter, smStarInner, "#FFFFFF");
        drawStar(ctx, borderX + borderW * 0.7, borderY - shadowOffset, 4, smStarOuter, smStarInner, "#FFD700");
        drawStar(ctx, borderX + borderW * 0.3, borderY + borderH + shadowOffset, 4, smStarOuter, smStarInner, "#FFD700");
        drawStar(ctx, borderX + borderW * 0.7, borderY + borderH + shadowOffset, 4, smStarOuter, smStarInner, "#FFFFFF");
    }

    // Return buffer
    return canvas.toBuffer("image/png");
}

/**
 * Merges two profile pictures side-by-side (diagonally overlapping) in a square canvas.
 * This makes the image look much larger on mobile screens and provides a premium look.
 * @param {Buffer} pfpBuffer1 - Teammate 1's profile picture buffer.
 * @param {Buffer} pfpBuffer2 - Teammate 2's profile picture buffer.
 * @returns {Promise<Buffer>} - The merged and styled image buffer.
 */
async function applyDuoPfpEffects(pfpBuffer1, pfpBuffer2) {
    // 1. Load both profile pictures
    const img1 = await loadPfpImage(pfpBuffer1);
    const img2 = await loadPfpImage(pfpBuffer2);

    // 2. Set target canvas size (Square 1000x1000 for perfect mobile fit)
    const canvasW = 1000;
    const canvasH = 1000;
    const padding = 80;

    // Size of each PFP image
    const W = 580;
    const H = 580;

    // Coordinate offsets for diagonal layout (top-left & bottom-right)
    const x1 = padding;
    const y1 = padding;
    const x2 = canvasW - padding - W; // 340
    const y2 = canvasH - padding - H; // 340

    // Create combined canvas
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvasW, canvasH);

    const borderRadius = 50;
    const imageRadius = Math.max(8, borderRadius - 8);

    const borderW = W + 36;
    const borderH = H + 36;

    // Helper to draw a complete glowing PFP box
    function drawPfpWithGlow(img, x, y) {
        const borderX = x - 18;
        const borderY = y - 18;

        // Draw soft back shadow
        ctx.save();
        ctx.shadowColor = "rgba(255, 0, 127, 0.25)";
        ctx.shadowBlur = 15;
        roundRect(ctx, borderX, borderY, borderW, borderH, borderRadius);
        ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
        ctx.fill();
        ctx.restore();

        // Draw clipped PFP image
        ctx.save();
        roundRect(ctx, x, y, W, H, imageRadius);
        ctx.clip();
        ctx.drawImage(img, x, y, W, H);
        ctx.restore();

        // Draw glowing border
        ctx.save();
        const grad = ctx.createLinearGradient(borderX, borderY, borderX + borderW, borderY + borderH);
        grad.addColorStop(0, "#FF007F");   // Neon Pink
        grad.addColorStop(0.33, "#7F00FF"); // Purple
        grad.addColorStop(0.66, "#00F0FF"); // Cyan
        grad.addColorStop(1, "#FFD700");   // Gold
        ctx.strokeStyle = grad;

        // Pass 1: Wide soft glow
        ctx.shadowColor = "rgba(0, 240, 255, 0.6)";
        ctx.shadowBlur = 25;
        ctx.lineWidth = 6;
        roundRect(ctx, borderX, borderY, borderW, borderH, borderRadius);
        ctx.stroke();

        // Pass 2: Tight core glow
        ctx.shadowColor = "rgba(255, 0, 127, 0.85)";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 5;
        roundRect(ctx, borderX, borderY, borderW, borderH, borderRadius);
        ctx.stroke();

        // Pass 3: Sharp core border
        ctx.shadowBlur = 0;
        ctx.lineWidth = 4;
        roundRect(ctx, borderX, borderY, borderW, borderH, borderRadius);
        ctx.stroke();

        ctx.restore();
    }

    // 3. Draw first PFP (Teammate 1, Top-Left)
    drawPfpWithGlow(img1, x1, y1);

    // 4. Draw second PFP (Teammate 2, Bottom-Right - overlaps PFP 1)
    drawPfpWithGlow(img2, x2, y2);

    // 5. Draw glowing stars
    const baseStarSize = Math.max(4, Math.floor(Math.min(W, H) * 0.025)); // ~14px
    const lgStarOuter = baseStarSize * 1.4;
    const lgStarInner = lgStarOuter * 0.4;
    const smStarOuter = baseStarSize * 0.6;
    const smStarInner = smStarOuter * 0.35;

    const starOffset = 15;
    const cornerOffset = 12;
    const shadowOffset = 8;

    // Stars on first PFP (Top-Left area)
    const borderX1 = x1 - 18;
    const borderY1 = y1 - 18;
    drawStar(ctx, borderX1 - cornerOffset, borderY1 - cornerOffset, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFFFFF"); // TL corner
    drawStar(ctx, borderX1 + borderW + cornerOffset, borderY1 - cornerOffset, 4, lgStarOuter, lgStarInner, "#FFD700"); // TR corner
    drawStar(ctx, borderX1 - cornerOffset, borderY1 + borderH + cornerOffset, 4, lgStarOuter, lgStarInner, "#FFD700"); // BL corner
    drawStar(ctx, borderX1 - starOffset, borderY1 + borderH / 2, 4, lgStarOuter, lgStarInner, "#FFFFFF"); // L Middle
    drawStar(ctx, borderX1 + borderW / 2, borderY1 - starOffset, 4, lgStarOuter, lgStarInner, "#FFD700"); // T Middle
    
    // Sparkles on first PFP
    drawStar(ctx, borderX1 - shadowOffset, borderY1 + borderH * 0.3, 4, smStarOuter, smStarInner, "#FFFFFF");
    drawStar(ctx, borderX1 + borderW * 0.3, borderY1 - shadowOffset, 4, smStarOuter, smStarInner, "#FFD700");

    // Stars on second PFP (Bottom-Right area)
    const borderX2 = x2 - 18;
    const borderY2 = y2 - 18;
    drawStar(ctx, borderX2 + borderW + cornerOffset, borderY2 + borderH + cornerOffset, 4, lgStarOuter * 1.33, lgStarInner * 1.33, "#FFFFFF"); // BR corner
    drawStar(ctx, borderX2 + borderW + cornerOffset, borderY2 - cornerOffset, 4, lgStarOuter, lgStarInner, "#FFD700"); // TR corner
    drawStar(ctx, borderX2 - cornerOffset, borderY2 + borderH + cornerOffset, 4, lgStarOuter, lgStarInner, "#FFD700"); // BL corner
    drawStar(ctx, borderX2 + borderW + starOffset, borderY2 + borderH / 2, 4, lgStarOuter, lgStarInner, "#FFFFFF"); // R Middle
    drawStar(ctx, borderX2 + borderW / 2, borderY2 + borderH + starOffset, 4, lgStarOuter, lgStarInner, "#FFD700"); // B Middle

    // Sparkles on second PFP
    drawStar(ctx, borderX2 + borderW + shadowOffset, borderY2 + borderH * 0.7, 4, smStarOuter, smStarInner, "#FFFFFF");
    drawStar(ctx, borderX2 + borderW * 0.7, borderY2 + borderH + shadowOffset, 4, smStarOuter, smStarInner, "#FFD700");

    // Large center star tying both together in the middle overlap
    drawStar(ctx, canvasW / 2, canvasH / 2, 4, lgStarOuter * 1.5, lgStarInner * 1.5, "#FFFFFF");

    // 6. Return buffer
    return canvas.toBuffer("image/png");
}

module.exports = { applyPfpEffects, applyDuoPfpEffects };
