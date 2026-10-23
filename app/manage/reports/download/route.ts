import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getManagerContext } from "@/lib/manager";
import { getReportData, resolvePeriod, type ReportData } from "@/lib/reports";

const money = (value: number) => value.toFixed(2);
// The built-in PDF fonts only handle basic characters
const clean = (text: string) => text.replace(/[^\x20-\x7E]/g, "?");

async function buildExcel(data: ReportData) {
  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [{ width: 36 }, { width: 28 }];
  const lines: [string, string | number][] = [
    ["Hotel", data.hotelName],
    ["Period (check-in)", `${data.from} to ${data.to}`],
    ["", ""],
    ["Booking report", ""],
    ["Confirmed bookings", data.summary.confirmed],
    ["Cancelled bookings", data.summary.cancelled],
    ["Nights booked", data.summary.nights],
    ["Registered customers", data.summary.registered],
    ["Guests", data.summary.guests],
    ["Cancellation requests waiting", data.summary.waiting],
    ["", ""],
    ["Financial report (RM)", ""],
    ["Payments received (RM)", data.finance.gross],
    ["Refunded (RM)", data.finance.refunded],
    ["Net revenue (RM)", data.finance.net],
  ];
  for (const [label, value] of lines) {
    const row = summarySheet.addRow([label, value]);
    if (value === "" && label !== "") {
      row.font = { bold: true };
    }
    if (label.endsWith("(RM)") && typeof value === "number") {
      row.getCell(2).numFmt = "0.00";
    }
  }

  const roomSheet = workbook.addWorksheet("By room");
  roomSheet.columns = [
    { header: "Room", width: 30 },
    { header: "Bookings", width: 12 },
    { header: "Nights", width: 12 },
    { header: "Revenue (RM)", width: 16 },
  ];
  roomSheet.getRow(1).font = { bold: true };
  for (const r of data.rooms) {
    const row = roomSheet.addRow([r.name, r.bookings, r.nights, r.revenue]);
    row.getCell(4).numFmt = "0.00";
  }

  const bookingSheet = workbook.addWorksheet("Bookings");
  bookingSheet.columns = [
    { header: "Reference", width: 38 },
    { header: "Room", width: 24 },
    { header: "Guest", width: 24 },
    { header: "Email", width: 30 },
    { header: "Phone", width: 18 },
    { header: "Check-in", width: 12 },
    { header: "Check-out", width: 12 },
    { header: "Nights", width: 8 },
    { header: "Total (RM)", width: 12 },
    { header: "Booked as", width: 12 },
    { header: "Payment", width: 12 },
    { header: "Status", width: 24 },
  ];
  bookingSheet.getRow(1).font = { bold: true };
  for (const b of data.bookings) {
    const row = bookingSheet.addRow([
      b.reference,
      b.room,
      b.guestName,
      b.guestEmail,
      b.guestPhone,
      b.checkIn,
      b.checkOut,
      b.nights,
      b.total,
      b.bookedAs,
      b.paymentStatus,
      b.status,
    ]);
    row.getCell(9).numFmt = "0.00";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as unknown as ArrayLike<number>);
}

async function buildPdf(data: ReportData) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 790;

  const ensureSpace = () => {
    if (y < 60) {
      page = doc.addPage([595, 842]);
      y = 790;
    }
  };
  const text = (value: string, size = 11, isBold = false) => {
    ensureSpace();
    page.drawText(clean(value), { x: 50, y, size, font: isBold ? bold : font });
    y -= size + 7;
  };
  const row = (cells: string[], xs: number[], isBold = false) => {
    ensureSpace();
    cells.forEach((cell, i) =>
      page.drawText(clean(cell), { x: xs[i], y, size: 10, font: isBold ? bold : font })
    );
    y -= 17;
  };

  text("Hotel Report", 18, true);
  text(data.hotelName, 12, true);
  text(`Bookings with check-in from ${data.from} to ${data.to}`);
  text("Amounts are in RM.");
  y -= 10;

  text("Booking report", 14, true);
  text(`Confirmed bookings: ${data.summary.confirmed}`);
  text(`Cancelled bookings: ${data.summary.cancelled}`);
  text(`Nights booked: ${data.summary.nights}`);
  text(`Registered customers: ${data.summary.registered}`);
  text(`Guests: ${data.summary.guests}`);
  text(`Cancellation requests waiting: ${data.summary.waiting}`);
  y -= 10;

  text("By room", 14, true);
  const xs = [50, 280, 360, 430];
  row(["Room", "Bookings", "Nights", "Revenue (RM)"], xs, true);
  for (const r of data.rooms) {
    row([r.name.slice(0, 36), String(r.bookings), String(r.nights), money(r.revenue)], xs);
  }
  y -= 10;

  text("Financial report", 14, true);
  text(`Payments received: RM ${money(data.finance.gross)}`);
  text(`Refunded: RM ${money(data.finance.refunded)}`);
  text(`Net revenue: RM ${money(data.finance.net)}`);
  y -= 10;

  const generated = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
  });
  text(`Generated: ${generated} (Malaysia time)`, 9);

  const saved = await doc.save();
  return new Uint8Array(saved);
}

export async function GET(request: Request) {
  const manager = await getManagerContext();
  if (!manager) {
    return new Response("Not allowed", { status: 403 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const { from, to } = resolvePeriod(
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined
  );

  const result = await getReportData(manager.hotelId, manager.hotelName, from, to);
  if (!result.ok) {
    return new Response("Could not build the report", { status: 500 });
  }

  const baseName = `hotel-report-${from}-to-${to}`;

  if (format === "xlsx") {
    return new Response(await buildExcel(result.data), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "pdf") {
    return new Response(await buildPdf(result.data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response("Unknown format", { status: 400 });
}