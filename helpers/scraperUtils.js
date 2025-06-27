// helpers/scraperUtils.js

export async function getCurrentProductCount(page) {
  try {
    await page.waitForSelector("ul.ProductListingResults__productList", {
      timeout: 15000,
    });

    // Try to get count from "You have viewed X of Y"
    try {
      console.log("first");
      const countText = await page.$eval(
        "p.Text-ds.Text-ds--body-2.Text-ds--center.Text-ds--black",
        (el) => el.textContent.trim()
      );
      console.log({ countText });
      const matches = countText.match(/You have viewed (\d+) of (\d+)/);
      console.log({ matches });
      console.log("1: ", parseInt(matches[1]));
      console.log("2: ", parseInt(matches[2]));
      if (matches) {
        return {
          current: parseInt(matches[1]),
          total: parseInt(matches[2]),
        };
      }
    } catch {
      console.log("Could not parse count text, using fallback");
    }

    // Fallback: count visible products
    const visibleProducts = await page.$$(
      "ul.ProductListingResults__productList li.ProductListingResults__productCard"
    );
    return {
      current: visibleProducts.length,
      total: visibleProducts.length > 0 ? visibleProducts.length * 3 : 0,
    };
  } catch (error) {
    console.error("Error in getCurrentProductCount:", error);
    return { current: 0, total: 0 };
  }
}

export async function attemptLoadMore(page) {
  try {
    const button = await page.$("button.LoadContent__button:not([disabled])");
    if (button) {
      await button.scrollIntoViewIfNeeded();
      await button.click();
      console.log('"Load More" button clicked');
      return true;
    } else {
      console.log("No Load More button found");
    }
    return false;
  } catch (error) {
    console.log("Load more click failed:", error.message);
    return false;
  }
}

async function waitForNewProducts(page, previousCount) {
  try {
    await page.waitForFunction(
      (prev) => {
        const products = document.querySelectorAll(
          "ul.ProductListingResults__productList li.ProductListingResults__productCard"
        );
        return products.length > prev;
      },
      { timeout: 15000 },
      previousCount
    );
    return true;
  } catch {
    console.log("Timeout waiting for new products to load");
    return false;
  }
}

export async function collectUntilCount(
  page,
  targetCount,
  collectedProducts = []
) {
  let attempts = 0;
  const maxAttempts = 10;
  let lastCount = 0;

  while (collectedProducts.length < targetCount && attempts < maxAttempts) {
    try {
      const currentProducts = await page.$$eval(
        "ul.ProductListingResults__productList li.ProductListingResults__productCard div.ProductCard a",
        (anchors, existingUrls) =>
          anchors
            .filter((a) => !existingUrls.includes(a.href))
            .map((a) => ({
              url: a.href,
              hasVariants: a.querySelector(".ProductCard__variants") !== null,
            })),
        collectedProducts.map((p) => p.url)
      );

      if (currentProducts.length > 0) {
        collectedProducts.push(...currentProducts);
        console.log(
          `Added ${currentProducts.length} products (Total: ${collectedProducts.length})`
        );
        attempts = 0;
        lastCount = collectedProducts.length;
      } else {
        attempts++;
        console.log(
          `No new products found (Attempt ${attempts}/${maxAttempts})`
        );
      }

      if (collectedProducts.length < targetCount) {
        console.log("Trying to click Load More...");
        const loadedMore = await attemptLoadMore(page);
        if (loadedMore) {
          await waitForNewProducts(page, lastCount);
        } else {
          console.log("No Load More or failed to load more");
          break;
        }
      }
    } catch (error) {
      attempts++;
      console.log(
        `Collection error (Attempt ${attempts}/${maxAttempts}):`,
        error.message
      );
      await page.waitForTimeout(2000);
    }
  }

  return collectedProducts;
}
