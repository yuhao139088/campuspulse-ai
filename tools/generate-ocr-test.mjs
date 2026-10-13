import sharp from "sharp";
import fs from "node:fs";
fs.mkdirSync(".deployment-private", { recursive: true });
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720"><rect width="1200" height="720" fill="white"/><g fill="black" font-family="Arial" font-size="48"><text x="70" y="120">CampusPulse Workshop</text><text x="70" y="220">Date: 2026-10-12</text><text x="70" y="320">Registrations: 56</text><text x="70" y="420">Check-ins: 43</text><text x="70" y="520">Budget: 1280 CNY</text><text x="70" y="620">Location: Campus Hall</text></g></svg>';
await sharp(Buffer.from(svg)).png().toFile(".deployment-private/ocr-verification.png");
console.log("Original OCR test image generated");
