const { createCanvas, loadImage } = require("@napi-rs/canvas");

const BANNER_WIDTH = 1024;
const BANNER_HEIGHT = 450;
const JPEG_QUALITY = 0.92;

async function generateWelcomeBanner(member, guild, customBannerUrl = null) {
  const canvas = createCanvas(BANNER_WIDTH, BANNER_HEIGHT);
  const ctx = canvas.getContext("2d");

  // ── BACKGROUND ──
  if (customBannerUrl) {
    try {
      const bannerImage = await loadImage(customBannerUrl);
      const scale = Math.max(BANNER_WIDTH / bannerImage.width, BANNER_HEIGHT / bannerImage.height);
      const scaledWidth = bannerImage.width * scale;
      const scaledHeight = bannerImage.height * scale;
      const offsetX = (BANNER_WIDTH - scaledWidth) / 2;
      const offsetY = (BANNER_HEIGHT - scaledHeight) / 2;

      ctx.drawImage(bannerImage, offsetX, offsetY, scaledWidth, scaledHeight);
      ctx.fillStyle = "rgba(0, 0, 0, 0.50)";
      ctx.fillRect(0, 0, BANNER_WIDTH, BANNER_HEIGHT);
    } catch (err) {
      console.error("[Custom Banner Load Error]", err.message);
      drawGradientBackground(ctx, BANNER_WIDTH, BANNER_HEIGHT);
    }
  } else {
    drawGradientBackground(ctx, BANNER_WIDTH, BANNER_HEIGHT);
  }

  // ── GLOW EFFECT ──
  ctx.shadowColor = "rgba(233, 69, 96, 0.3)";
  ctx.shadowBlur = 60;
  ctx.fillStyle = "rgba(233, 69, 96, 0.1)";
  ctx.beginPath();
  ctx.arc(BANNER_WIDTH / 2, BANNER_HEIGHT / 2, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ── AVATAR ──
  const avatarSize = 160;
  const avatarX = BANNER_WIDTH / 2;
  const avatarY = 130;

  ctx.shadowColor = "rgba(255, 255, 255, 0.4)";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize / 2 + 6, 0, Math.PI * 2);
  ctx.fillStyle = "#e94560";
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  try {
    const avatarURL = member.user.displayAvatarURL({ extension: "png", size: 256 });
    const avatar = await loadImage(avatarURL);
    ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
  } catch {
    ctx.fillStyle = "#2d2d44";
    ctx.fillRect(avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 70px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(member.user.username.charAt(0).toUpperCase(), avatarX, avatarY);
  }
  ctx.restore();

  ctx.strokeStyle = "#e94560";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize / 2 + 2, 0, Math.PI * 2);
  ctx.stroke();

  // ── TEXT ──
  const displayName = member.displayName.length > 18 
    ? member.displayName.slice(0, 15) + "..." 
    : member.displayName;

  ctx.fillStyle = "#e94560";
  ctx.font = "bold 32px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("WELCOME", BANNER_WIDTH / 2, 245);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px Arial, sans-serif";
  ctx.fillText(displayName, BANNER_WIDTH / 2, 290);

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "24px Arial, sans-serif";
  const serverName = guild.name.length > 28 ? guild.name.slice(0, 25) + "..." : guild.name;
  ctx.fillText(`to ${serverName}`, BANNER_WIDTH / 2, 330);

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "20px Arial, sans-serif";
  ctx.fillText(`You are our ${guild.memberCount}th member`, BANNER_WIDTH / 2, 365);

  // ── DECORATION ──
  ctx.strokeStyle = "#e94560";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(20, 50);
  ctx.lineTo(20, 20);
  ctx.lineTo(50, 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(BANNER_WIDTH - 50, 20);
  ctx.lineTo(BANNER_WIDTH - 20, 20);
  ctx.lineTo(BANNER_WIDTH - 20, 50);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(20, BANNER_HEIGHT - 50);
  ctx.lineTo(20, BANNER_HEIGHT - 20);
  ctx.lineTo(50, BANNER_HEIGHT - 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(BANNER_WIDTH - 50, BANNER_HEIGHT - 20);
  ctx.lineTo(BANNER_WIDTH - 20, BANNER_HEIGHT - 20);
  ctx.lineTo(BANNER_WIDTH - 20, BANNER_HEIGHT - 50);
  ctx.stroke();

  return await canvas.encode("jpeg", JPEG_QUALITY * 100);
}

function drawGradientBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#1a1a2e");
  gradient.addColorStop(0.5, "#16213e");
  gradient.addColorStop(1, "#0f3460");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 2;
  for (let i = 0; i < width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  for (let i = 0; i < height; i += 40) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(width, i);
    ctx.stroke();
  }
}

module.exports = { generateWelcomeBanner };
