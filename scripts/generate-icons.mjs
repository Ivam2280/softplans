import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const directory = new URL("../public/icons/", import.meta.url);
const svg = await readFile(new URL("icon.svg", directory), "utf8");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [name, size, solid] of [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["icon-maskable.png", 512, true],
    ["apple-touch-icon.png", 180, true],
  ]) {
    const data = await page.evaluate(
      async ({ svg, size, solid }) => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (solid) {
          context.fillStyle = "#6e64c2";
          context.fillRect(0, 0, size, size);
        }
        const icon = new Image();
        icon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        await icon.decode();
        context.drawImage(icon, 0, 0, size, size);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { svg, size, solid },
    );
    await writeFile(new URL(name, directory), Buffer.from(data, "base64"));
  }
} finally {
  await browser.close();
}
