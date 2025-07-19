import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { createExcelFile } from "./helpers/fileUtils.js";
import {
  getCurrentProductCount,
  collectUntilCount,
} from "./helpers/scraperUtils.js";
import { fileURLToPath } from "url";

// Get the current directory equivalent to __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
//This brand url must be changed when the code is run
const targetUrl = "https://www.ulta.com/brand/ulta-beauty-collection";

const desiredProductCount = 500;
const outputsDir = path.join(__dirname, "outputs");
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir);
}

async function scrapeUltaProducts(url, desiredCount) {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-sandbox",
    ],
    timeout: 1200000,
  });

  const page = await browser.newPage();

  try {
    console.info(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

    const { current, total } = await getCurrentProductCount(page);
    console.info(
      `Found ${current} products on initial page out of ${total} total`
    );

    const targetCount = Math.min(desiredCount, total);
    console.info(`Targeting ${targetCount} product URLs...`);

    const collectedProducts = [];
    await collectUntilCount(page, targetCount, collectedProducts);

    const uniqueProducts = [
      ...new Map(collectedProducts.map((item) => [item.url, item])).values(),
    ];
    console.info(
      `Successfully collected ${uniqueProducts.length} unique product URLs`
    );

    // Process URL path for filenames
    const urlPath = new URL(url).pathname.replace(/^\/|\/$/g, "");
    const filenameBase = urlPath.split("/").join("_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Create Excel file with SKU extraction
    const excelFilename = path.join(
      outputsDir,
      `${filenameBase}_${timestamp}.xlsx`
    );
    createExcelFile(
      excelFilename,
      uniqueProducts,
      urlPath,
      uniqueProducts.length,
      total
    );
    console.info(`Excel file saved to ${excelFilename}`);

    // Create JSON file with updated format
    const urls = uniqueProducts.map((p) => p.url);

    const chunkedUrls = {};
    for (let i = 0; i < urls.length; i += 10) {
      const key = `array${Math.floor(i / 10) + 1}`;
      chunkedUrls[key] = urls.slice(i, i + 10);
    }

    // Extract brand name from URL
    const urlObj = new URL(targetUrl);
    const brandName = urlObj.pathname.split("/").filter(Boolean).pop(); // 'it-cosmetics'

    const jsonStructure = {
      urls: chunkedUrls,
      summary: {
        extra_tags: [brandName],
        collection_url: [targetUrl],
        total_products: uniqueProducts.length,
      },
    };

    const jsonFilename = path.join(
      outputsDir,
      `${filenameBase}_${timestamp}.json`
    );
    fs.writeFileSync(
      jsonFilename,
      JSON.stringify(jsonStructure, null, 2),
      "utf-8"
    );
    console.info(`✅ JSON file saved to ${jsonFilename}`);
  } catch (error) {
    console.error("Scraping error:", error);
  } finally {
    await browser.close();
  }
}

scrapeUltaProducts(targetUrl, desiredProductCount);
