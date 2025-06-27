import XLSX from "xlsx";

function getNextFilename(baseName) {
  // Not needed anymore since we're using timestamps
  return `${baseName}.xlsx`;
}

export function createExcelFile(
  filename,
  data,
  collectionName,
  collectedCount,
  totalCount
) {
  const workbook = XLSX.utils.book_new();

  // Prepare product data with SKU extraction
  const productData = data.map((product, index) => {
    // Extract SKU from URL
    const skuMatch = product.url.match(/sku=(\d+)/);
    const sku = skuMatch ? skuMatch[1] : "N/A";

    return {
      ID: index + 1,
      "Product URL": product.url,
      SKU: sku,
    };
  });

  // Add products sheet
  const productSheet = XLSX.utils.json_to_sheet(productData);
  XLSX.utils.book_append_sheet(workbook, productSheet, "Products");

  // Add summary sheet
  const summaryData = [
    { Collection: collectionName },
    { "Products Collected": collectedCount },
    { "Total Available": totalCount },
    { "Date Collected": new Date().toISOString() },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  XLSX.writeFile(workbook, filename);
}
