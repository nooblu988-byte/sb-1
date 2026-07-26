const { createState, createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");
const fs = require("fs");
const path = require("path");

/**
 * Draws a star on the canvas context with rotation and scale.
 */
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color, angle = 0, scale = 1) {
    let rot = (Math.PI / 2 * 3) + angle;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    let oRad = outerRadius * scale;
    let iRad = innerRadius * scale;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - oRad);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * oRad;
        y = cy + Math.sin(rot) * oRad;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * iRad;
        y = cy + Math.sin(rot) * iRad;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - oRad);
    ctx.closePath();
    ctx.fillStyle = color;
    
    // Lighter, glitter glowing effect
    ctx.shadowBlur = 6;
    ctx.shadowColor = color;
    ctx.fill();
    ctx.restore();
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
    ctx.lineTo(x + radius, y + radius);
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
 * Applies animated glitter stars/sparkles around the PFP (keeps original dimensions).
 * @param {Buffer} pfpBuffer - The original image buffer.
 * @param {boolean} isDuo - Whether this is a duo participant.
 * @returns {Promise<Buffer>} - The processed animated GIF buffer.
 */
async function applyPfpEffects(pfpBuffer, isDuo = false) {
    const img = await loadPfpImage(pfpBuffer);

    // Keep the original image dimensions exactly as requested
    const W = img.width;
    const H = img.height;

    // Pad the canvas minimally to leave room for the floating stars without shrinking the PFP
    const padding = 30;
    const canvasW = W + padding * 2;
    const canvasH = H + padding * 2;

    // Initialize GIF encoder with optimizer enabled
    const encoder = new GIFEncoder(canvasW, canvasH, 'octree', true);
    encoder.start();
    encoder.setRepeat(0); // Loop forever
    encoder.setDelay(120); // 120ms per frame
    encoder.setQuality(10); // Standard quality to keep encoding fast and memory low

    const totalFrames = 8;
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext("2d");

    const borderX = padding;
    const borderY = padding;
    const borderW = W;
    const borderH = H;

    // Floating distances for the stars
    const starOffset = 12;
    const cornerOffset = 10;
    const shadowOffset = 8;

    // Glowing shining stars sizing
    const baseStarSize = Math.max(5, Math.floor(Math.min(W, H) * 0.028));
    const lgStarOuter = baseStarSize * 1.4;
    const lgStarInner = lgStarOuter * 0.18; // Glitter style (narrow waist)
    const smStarOuter = baseStarSize * 0.6;
    const smStarInner = smStarOuter * 0.15; // Glitter style (narrow waist)

    // Build static parameters for the stars, assigning unique phase offsets to animate them out of sync
    const stars = [
        // Middle Edges
        { cx: borderX - starOffset, cy: borderY + borderH / 2, spikes: 4, outer: lgStarOuter, inner: lgStarInner, color: "#FFD700", phase: 0 },
        { cx: borderX + borderW + starOffset, cy: borderY + borderH / 2, spikes: 4, outer: lgStarOuter, inner: lgStarInner, color: "#FFFFFF", phase: Math.PI / 2 },
        { cx: borderX + borderW / 2, cy: borderY - starOffset, spikes: 4, outer: lgStarOuter, inner: lgStarInner, color: "#FFD700", phase: Math.PI },
        { cx: borderX + borderW / 2, cy: borderY + borderH + starOffset, spikes: 4, outer: lgStarOuter, inner: lgStarInner, color: "#FFFFFF", phase: (3 * Math.PI) / 2 },

        // Corners
        { cx: borderX - cornerOffset, cy: borderY - cornerOffset, spikes: 4, outer: lgStarOuter * 1.2, inner: lgStarInner * 1.2, color: "#FFFFFF", phase: Math.PI / 4 },
        { cx: borderX + borderW + cornerOffset, cy: borderY - cornerOffset, spikes: 4, outer: lgStarOuter * 1.2, inner: lgStarInner * 1.2, color: "#FFD700", phase: (3 * Math.PI) / 4 },
        { cx: borderX - cornerOffset, cy: borderY + borderH + cornerOffset, spikes: 4, outer: lgStarOuter * 1.2, inner: lgStarInner * 1.2, color: "#FFD700", phase: (5 * Math.PI) / 4 },
        { cx: borderX + borderW + cornerOffset, cy: borderY + borderH + cornerOffset, spikes: 4, outer: lgStarOuter * 1.2, inner: lgStarInner * 1.2, color: "#FFFFFF", phase: (7 * Math.PI) / 4 },

        // Sparkles
        { cx: borderX - shadowOffset, cy: borderY + borderH * 0.3, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFFFFF", phase: Math.PI / 3 },
        { cx: borderX - shadowOffset, cy: borderY + borderH * 0.7, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFD700", phase: (4 * Math.PI) / 3 },
        { cx: borderX + borderW + shadowOffset, cy: borderY + borderH * 0.3, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFD700", phase: (2 * Math.PI) / 3 },
        { cx: borderX + borderW + shadowOffset, cy: borderY + borderH * 0.7, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFFFFF", phase: (5 * Math.PI) / 3 },

        // Top/Bottom sparkles
        { cx: borderX + borderW * 0.3, cy: borderY - shadowOffset, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFFFFF", phase: Math.PI / 6 },
        { cx: borderX + borderW * 0.7, cy: borderY - shadowOffset, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFD700", phase: (7 * Math.PI) / 6 },
        { cx: borderX + borderW * 0.3, cy: borderY + borderH + shadowOffset, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFD700", phase: (5 * Math.PI) / 6 },
        { cx: borderX + borderW * 0.7, cy: borderY + borderH + shadowOffset, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFFFFF", phase: (11 * Math.PI) / 6 }
    ];

    for (let f = 0; f < totalFrames; f++) {
        // Clear frame
        ctx.clearRect(0, 0, canvasW, canvasH);

        // Draw original PFP (no resizing, no scaling)
        ctx.drawImage(img, padding, padding, W, H);

        const progress = (f / totalFrames) * 2 * Math.PI;

        // Draw glittering stars
        for (const star of stars) {
            // Pulse the star scale (between 0.45 and 1.15)
            const scale = 0.8 + 0.35 * Math.sin(progress + star.phase);
            // Rotate the star
            const angle = progress * 0.25 + star.phase;

            drawStar(ctx, star.cx, star.cy, star.spikes, star.outer, star.inner, star.color, angle, scale);
        }

        encoder.addFrame(ctx);
    }

    encoder.finish();
    return encoder.out.getData();
}

/**
 * Merges two profile pictures side-by-side with an overlapping glow effect (animated).
 * @param {Buffer} pfpBuffer1 - Teammate 1's profile picture buffer.
 * @param {Buffer} pfpBuffer2 - Teammate 2's profile picture buffer.
 * @returns {Promise<Buffer>} - The merged and styled animated GIF buffer.
 */
async function applyDuoPfpEffects(pfpBuffer1, pfpBuffer2) {
    // 1. Load both profile pictures
    const img1 = await loadPfpImage(pfpBuffer1);
    const img2 = await loadPfpImage(pfpBuffer2);

    // 2. Set target size for each avatar (keep 1024x1024 from original code, but generate GIF efficiently)
    const W = 1024;
    const H = 1024;
    const gap = 48;

    const combinedW = W * 2 + gap;
    const combinedH = H;

    const padding = 130;
    const canvasW = combinedW + padding * 2;
    const canvasH = combinedH + padding * 2;

    // Initialize GIF encoder with optimizer enabled
    const encoder = new GIFEncoder(canvasW, canvasH, 'octree', true);
    encoder.start();
    encoder.setRepeat(0); // loop forever
    encoder.setDelay(120); // 120ms per frame
    encoder.setQuality(10); // Standard quality for faster encoding

    const totalFrames = 8;
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext("2d");

    const borderX = padding - 36;
    const borderY = padding - 36;
    const borderW = combinedW + 72;
    const borderH = combinedH + 72;
    const borderRadius = 92;
    const imageRadius = Math.max(16, borderRadius - 16);

    const baseStarSize = Math.max(8, Math.floor(Math.min(W, H) * 0.025));
    const lgStarOuter = baseStarSize * 1.4;
    const lgStarInner = lgStarOuter * 0.18; // Glitter style (narrow waist)
    const smStarOuter = baseStarSize * 0.6;
    const smStarInner = smStarOuter * 0.15; // Glitter style (narrow waist)

    const starOffset = 30;
    const cornerOffset = 24;
    const shadowOffset = 16;

    // Define borders stars parameters
    const stars = [
        // Corners
        { cx: borderX - cornerOffset, cy: borderY - cornerOffset, spikes: 4, outer: lgStarOuter * 1.2, inner: lgStarInner * 1.2, color: "#FFFFFF", phase: Math.PI / 4 },
        { cx: borderX + borderW + cornerOffset, cy: borderY - cornerOffset, spikes: 4, outer: lgStarOuter * 1.2, inner: lgStarInner * 1.2, color: "#FFD700", phase: (3 * Math.PI) / 4 },
        { cx: borderX - cornerOffset, cy: borderY + borderH + cornerOffset, spikes: 4, outer: lgStarOuter * 1.2, inner: lgStarInner * 1.2, color: "#FFD700", phase: (5 * Math.PI) / 4 },
        { cx: borderX + borderW + cornerOffset, cy: borderY + borderH + cornerOffset, spikes: 4, outer: lgStarOuter * 1.2, inner: lgStarInner * 1.2, color: "#FFFFFF", phase: (7 * Math.PI) / 4 },

        // Middle Edges
        { cx: borderX - starOffset, cy: borderY + borderH / 2, spikes: 4, outer: lgStarOuter, inner: lgStarInner, color: "#FFD700", phase: 0 },
        { cx: borderX + borderW + starOffset, cy: borderY + borderH / 2, spikes: 4, outer: lgStarOuter, inner: lgStarInner, color: "#FFFFFF", phase: Math.PI / 2 },
        { cx: borderX + borderW / 2, cy: borderY - starOffset, spikes: 4, outer: lgStarOuter, inner: lgStarInner, color: "#FFD700", phase: Math.PI },
        { cx: borderX + borderW / 2, cy: borderY + borderH + starOffset, spikes: 4, outer: lgStarOuter, inner: lgStarInner, color: "#FFFFFF", phase: (3 * Math.PI) / 2 },

        // Sparkles
        { cx: borderX - shadowOffset, cy: borderY + borderH * 0.3, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFFFFF", phase: Math.PI / 3 },
        { cx: borderX - shadowOffset, cy: borderY + borderH * 0.7, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFD700", phase: (4 * Math.PI) / 3 },
        { cx: borderX + borderW + shadowOffset, cy: borderY + borderH * 0.3, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFD700", phase: (2 * Math.PI) / 3 },
        { cx: borderX + borderW + shadowOffset, cy: borderY + borderH * 0.7, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFFFFF", phase: (5 * Math.PI) / 3 },

        // Top/Bottom sparkles on the border
        { cx: borderX + borderW * 0.25, cy: borderY - shadowOffset, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFFFFF", phase: Math.PI / 6 },
        { cx: borderX + borderW * 0.75, cy: borderY - shadowOffset, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFD700", phase: (7 * Math.PI) / 6 },
        { cx: borderX + borderW * 0.25, cy: borderY + borderH + shadowOffset, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFD700", phase: (5 * Math.PI) / 6 },
        { cx: borderX + borderW * 0.75, cy: borderY + borderH + shadowOffset, spikes: 4, outer: smStarOuter, inner: smStarInner, color: "#FFFFFF", phase: (11 * Math.PI) / 6 }
    ];

    for (let f = 0; f < totalFrames; f++) {
        ctx.clearRect(0, 0, canvasW, canvasH);

        // 3. Draw a soft, attractive glowing shadow behind the main box
        ctx.save();
        ctx.shadowColor = "rgba(255, 0, 127, 0.25)";
        ctx.shadowBlur = 30;
        roundRect(ctx, borderX, borderY, borderW, borderH, borderRadius);
        ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
        ctx.fill();
        ctx.restore();

        // 4. Draw the clipped PFPs
        // First PFP
        ctx.save();
        roundRect(ctx, padding, padding, W, H, imageRadius);
        ctx.clip();
        ctx.drawImage(img1, padding, padding, W, H);
        ctx.restore();

        // Second PFP
        ctx.save();
        roundRect(ctx, padding + W + gap, padding, W, H, imageRadius);
        ctx.clip();
        ctx.drawImage(img2, padding + W + gap, padding, W, H);
        ctx.restore();

        // 5. Draw a soft neon gradient border with a strong neon glow around the outer boundary
        ctx.save();
        const grad = ctx.createLinearGradient(borderX, borderY, borderX + borderW, borderY + borderH);
        grad.addColorStop(0, "#FF007F");   // Neon Pink
        grad.addColorStop(0.33, "#7F00FF"); // Purple
        grad.addColorStop(0.66, "#00F0FF"); // Cyan
        grad.addColorStop(1, "#FFD700");   // Gold
        ctx.strokeStyle = grad;

        function strokeBorder(ctx) {
            roundRect(ctx, borderX, borderY, borderW, borderH, borderRadius);
            ctx.stroke();

            const middleX = borderX + borderW / 2;
            ctx.beginPath();
            ctx.moveTo(middleX, borderY + 30);
            ctx.lineTo(middleX, borderY + borderH - 30);
            ctx.stroke();
        }

        // Draw first pass with a wide, soft cyan/purple glow
        ctx.shadowColor = "rgba(0, 240, 255, 0.6)";
        ctx.shadowBlur = 50;
        ctx.lineWidth = 12;
        strokeBorder(ctx);

        // Draw second pass with a tight, hot pink glow
        ctx.shadowColor = "rgba(255, 0, 127, 0.85)";
        ctx.shadowBlur = 24;
        ctx.lineWidth = 10;
        strokeBorder(ctx);

        // Draw third pass without glow to keep the gradient border sharp
        ctx.shadowBlur = 0;
        ctx.lineWidth = 8;
        strokeBorder(ctx);
        ctx.restore();

        // 6. Draw glittering stars
        const progress = (f / totalFrames) * 2 * Math.PI;
        for (const star of stars) {
            const scale = 0.8 + 0.35 * Math.sin(progress + star.phase);
            const angle = progress * 0.25 + star.phase;

            drawStar(ctx, star.cx, star.cy, star.spikes, star.outer, star.inner, star.color, angle, scale);
        }

        encoder.addFrame(ctx);
    }

    encoder.finish();
    return encoder.out.getData();
}

module.exports = { applyPfpEffects, applyDuoPfpEffects };
