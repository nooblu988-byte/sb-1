const { createCanvas, loadImage } = require("@napi-rs/canvas");

/**
 * Preprocesses and loads a profile picture buffer.
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
        } catch (jimpErr) {
            console.error("Jimp conversion also failed:", jimpErr.message);
            throw err;
        }
    }
    return img;
}

/**
 * Returns the original image buffer unmodified (canvas effects removed).
 */
async function applyPfpEffects(pfpBuffer, isDuo = false) {
    return pfpBuffer;
}

/**
 * Merges two profile pictures side-by-side cleanly without any decoration/borders.
 */
async function applyDuoPfpEffects(pfpBuffer1, pfpBuffer2) {
    const img1 = await loadPfpImage(pfpBuffer1);
    const img2 = await loadPfpImage(pfpBuffer2);

    const W = 512;
    const H = 512;
    const gap = 24;

    const combinedW = W * 2 + gap;
    const combinedH = H;

    const canvas = createCanvas(combinedW, combinedH);
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, combinedW, combinedH);

    ctx.drawImage(img1, 0, 0, W, H);
    ctx.drawImage(img2, W + gap, 0, W, H);

    return canvas.toBuffer("image/png");
}

module.exports = { applyPfpEffects, applyDuoPfpEffects };
