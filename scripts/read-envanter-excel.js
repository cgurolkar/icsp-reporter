const XLSX = require("xlsx");
const fs = require("fs");
const path = process.argv[2] || "C:\\Users\\VICTUS\\Desktop\\Envanter_Listesi.xlsx";
if (!fs.existsSync(path)) {
  console.error("File not found:", path);
  process.exit(1);
}
const buf = fs.readFileSync(path);
const wb = XLSX.read(buf, { type: "buffer" });
console.log("Sheets:", wb.SheetNames);
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
console.log("Headers:", JSON.stringify(data[0], null, 2));
console.log("First 3 rows:", JSON.stringify(data.slice(1, 4), null, 2));
