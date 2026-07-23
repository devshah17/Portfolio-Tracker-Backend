import { Request, Response } from "express";
import multer from "multer";
import * as xlsx from "xlsx";
import MutualFund from "../models/MutualFund.js";
import FundReport, { IFundHolding } from "../models/FundReport.js";

// Multer setup (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
}).single("file");

// ── CRUD for Mutual Funds ─────────────────────────────────────────────────

export const getMutualFunds = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const funds = await MutualFund.find({ user: userId }).sort({ name: 1 });
    res.status(200).json({ success: true, data: funds });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createMutualFund = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { name, amc, category } = req.body;
    const fund = await MutualFund.create({ name, amc, category, user: userId });
    res.status(201).json({ success: true, data: fund });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteMutualFund = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    await MutualFund.findOneAndDelete({ _id: id, user: userId });
    await FundReport.deleteMany({ mutualFundId: id });
    res.status(200).json({ success: true, message: "Mutual fund and reports deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── File Upload & Parsing ─────────────────────────────────────────────────

// Express route handler wrapper for multer
export const uploadFundReport = (req: Request, res: Response): void => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: "File upload error: " + err.message });
    }
    await processUploadedReport(req, res);
  });
};

const processUploadedReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params; // mutualFundId
    const { reportMonth } = req.body; // e.g. "2023-10"
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, error: "No file provided" });
      return;
    }
    if (!reportMonth) {
      res.status(400).json({ success: false, error: "reportMonth is required (YYYY-MM)" });
      return;
    }

    const fund = await MutualFund.findOne({ _id: id, user: userId });
    if (!fund) {
      res.status(404).json({ success: false, error: "Mutual Fund not found" });
      return;
    }

    let parsedData: IFundHolding[] = [];

    // Parse logic based on file type
    const ext = file.originalname.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      parsedData = parseExcel(file.buffer);
    } else {
      res.status(400).json({ success: false, error: "Unsupported file type. Please use XLSX or CSV templates." });
      return;
    }

    console.log(`[Fund Radar] Extracted Data Array Length:`, parsedData.length);
    console.log(`[Fund Radar] First 3 Extracted Data:`, JSON.stringify(parsedData.slice(0, 3), null, 2));

    if (parsedData.length === 0) {
      res.status(400).json({ success: false, error: "No valid data extracted from the file. Ensure the template format is correct." });
      return;
    }

    // Save to database (upsert for the specific month)
    const report = await FundReport.findOneAndUpdate(
      { mutualFundId: id, reportMonth },
      { data: parsedData },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: `Extracted ${parsedData.length} records successfully.`,
      data: report,
    });
  } catch (error: any) {
    console.error("Report processing error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to process report" });
  }
};

// ── Parsing Helpers ───────────────────────────────────────────────────────

const parseExcel = (buffer: Buffer): IFundHolding[] => {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // Using header: 1 to get a 2D array, which avoids issues with title rows confusing column keys
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  console.log(`[Fund Radar - Excel] Parsed rows (2D array): ${rows.length}`);

  const parsedData: IFundHolding[] = [];
  
  // The first row (index 0) is a title: 'Fund name '. The second row (index 1) is the headers.
  // We can just iterate from index 2 onwards if there is data.
  // Let's dynamically find the row that actually contains data (e.g. quantity is a number)
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue; // Skip empty rows

    // Template columns (based on row 1):
    // 0: 'Sr no '
    // 1: 'Name '
    // 2: 'Industry'
    // 3: 'Quantity '
    // 4: 'Market value in lakhs '
    // 5: '% of assets '

    const nameStr = row[1];
    const industryStr = row[2];
    const quantityVal = row[3];
    const amountVal = row[4];
    const weightVal = row[5];

    // Skip the header row itself or completely empty text
    if (typeof nameStr === "string" && (nameStr.trim().toLowerCase() === "name" || nameStr.trim() === "")) {
      continue;
    }
    
    // Check if name exists before adding
    if (nameStr) {
      parsedData.push({
        ticker: String(nameStr).trim().toUpperCase().replace(/[^A-Z0-9]/g, ""), // ID/Ticker logic
        name: String(nameStr).trim(),
        industry: industryStr ? String(industryStr).trim() : "Unknown",
        quantity: typeof quantityVal === "number" ? quantityVal : parseFloat(quantityVal) || 0,
        amount: typeof amountVal === "number" ? amountVal : parseFloat(amountVal) || 0,
        weight: typeof weightVal === "number" ? weightVal : parseFloat(weightVal) || 0,
      });
    }
  }
  return parsedData;
};



// ── Fetch Reports (Analysis) ──────────────────────────────────────────────

export const getFundReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const reports = await FundReport.find({ mutualFundId: id }).sort({ reportMonth: -1 }).lean();
    const fund = await MutualFund.findById(id).lean();
    res.status(200).json({ success: true, data: reports, fundName: fund?.name || 'Unknown Fund' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
