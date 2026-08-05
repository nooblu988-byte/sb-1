// Parses a free-text duration string into milliseconds and a clean display label.
// Supports combinations like "1 hour 30 minutes", "3d", "2 months", etc.

const UNIT_MS = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
};

// Order matters — more specific tokens (mo, mon) must be checked before the
// bare "m" shorthand so "1 month" isn't misread as "1 minute".
const UNIT_PATTERN =
    /(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|months?|mon|mo|years?|y)\b/gi;

function normalizeUnit(raw) {
    const u = raw.toLowerCase();
    if (u.startsWith("s")) return "second";
    if (u === "m" || u.startsWith("min")) return "minute";
    if (u.startsWith("h")) return "hour";
    if (u.startsWith("mo")) return "month";
    if (u.startsWith("d")) return "day";
    if (u.startsWith("w")) return "week";
    if (u.startsWith("y")) return "year";
    return null;
}

function parseDuration(text) {
    if (!text) return null;
    let totalMs = 0;
    let matched = false;
    const parts = [];

    for (const match of text.matchAll(UNIT_PATTERN)) {
        const amount = parseInt(match[1], 10);
        const unit = normalizeUnit(match[2]);
        if (!unit || isNaN(amount) || amount <= 0) continue;

        totalMs += amount * UNIT_MS[unit];
        parts.push(`${amount} ${unit}${amount === 1 ? "" : "s"}`);
        matched = true;
    }

    if (!matched || totalMs <= 0) return null;
    return { ms: totalMs, label: parts.join(" ") };
}

function formatDuration(ms) {
    if (ms < 60 * 1000) return `${Math.round(ms / 1000)}s`;
    if (ms < 60 * 60 * 1000) return `${Math.round(ms / (60 * 1000))}m`;
    if (ms < 24 * 60 * 60 * 1000) return `${Math.round(ms / (60 * 60 * 1000))}h`;
    return `${Math.round(ms / (24 * 60 * 60 * 1000))}d`;
}

module.exports = { parseDuration, formatDuration };
