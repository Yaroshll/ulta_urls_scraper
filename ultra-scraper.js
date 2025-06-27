const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { getNextFilename, createExcelFile } = require("./helpers/fileUtils");
const {
  getCurrentProductCount,
  collectUntilCount,
} = require("./helpers/scraperUtils");

// Ensure outputs directory exists
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
    timeout: 120000,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

    const { current, total } = await getCurrentProductCount(page);
    console.log(
      `Found ${current} products on initial page out of ${total} total`
    );

    const targetCount = Math.min(desiredCount, total);
    console.log(`Targeting ${targetCount} product URLs...`);

    const collectedProducts = [];
    await collectUntilCount(page, targetCount, collectedProducts);

    const uniqueProducts = [
      ...new Map(collectedProducts.map((item) => [item.url, item])).values(),
    ];
    console.log(
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
    await createExcelFile(
      excelFilename,
      uniqueProducts,
      urlPath,
      uniqueProducts.length,
      total
    );
    console.log(`Excel file saved to ${excelFilename}`);

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
    console.log(`✅ JSON file saved to ${jsonFilename}`);
  } catch (error) {
    console.error("Scraping error:", error);
  } finally {
    await browser.close();
  }
}

// Example usage
const targetUrl = "https://www.ulta.com/brand/it-cosmetics";
const desiredProductCount = 65;

scrapeUltaProducts(targetUrl, desiredProductCount);
