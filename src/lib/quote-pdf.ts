import { jsPDF } from "jspdf";
import type { calculateQuote } from "./quote-engine";
import { formatMoney, roadDistance } from "./quote-engine";
import { BANKING, DEFAULT_RIDER, DEFAULT_TERMS } from "./quote-terms";

type Quote = ReturnType<typeof calculateQuote>;

const GOLD: [number, number, number] = [212, 175, 85];
const INK: [number, number, number] = [22, 22, 28];
const MUTED: [number, number, number] = [110, 110, 118];
const RULE: [number, number, number] = [220, 220, 224];

export function makeQuoteRef(artistId: string, cityId: string, date: string): string {
  const clean = date.replace(/-/g, "");
  return `${artistId.slice(0, 2).toUpperCase()}-${cityId.slice(0, 4).toUpperCase()}-${clean}`;
}

export function downloadQuotePdf(quote: Quote, date: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  const ref = makeQuoteRef(quote.artist.id, quote.destination.id, date);
  const route = roadDistance(quote.originCity.id, quote.destination.id);
  const deposit = Math.round(quote.total / 2);
  const balance = quote.total - deposit;

  const setInk = () => doc.setTextColor(...INK);
  const setMuted = () => doc.setTextColor(...MUTED);
  const line = (yy: number) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.line(M, yy, W - M, yy);
  };
  const ensure = (need: number) => {
    if (y + need > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const heading = (text: string, size = 11) => {
    ensure(20);
    setMuted();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.text(text.toUpperCase(), M, y);
    y += 14;
    line(y);
    y += 10;
    setInk();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };

  // ============ Header band ============
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(...GOLD);
  doc.rect(M, 28, 34, 34, "F");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("P", M + 11, 52);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("PENYAPLAY BOOKINGS", M + 46, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 205);
  doc.text("Press play · home of entertainment", M + 46, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(`REF · ${ref}`, W - M, 46, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 205);
  doc.text(new Date().toISOString().slice(0, 10), W - M, 60, { align: "right" });

  y = 120;
  setInk();

  // ============ From / Event ============
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setMuted();
  doc.text("FROM", M, y);
  doc.text("EVENT", W / 2, y);
  y += 14;
  setInk();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Penya Play Productions", M, y);
  doc.text(quote.destination.name, W / 2, y);
  y += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setMuted();
  doc.text(`on behalf of ${quote.artist.name}`, M, y);
  doc.text(date, W / 2, y);
  y += 24;

  // ============ Total banner ============
  doc.setFillColor(248, 250, 240);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.roundedRect(M, y, W - 2 * M, 68, 8, 8, "FD");
  setMuted();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TOTAL PAYABLE", M + 16, y + 20);
  setInk();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(formatMoney(quote.total), M + 16, y + 48);
  setMuted();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${quote.originCity.name} → ${quote.destination.name}`, W - M - 16, y + 26, { align: "right" });
  doc.text(`${route.km} km · ${route.hours.toFixed(1)} h drive`, W - M - 16, y + 40, { align: "right" });
  y += 84;

  doc.setFontSize(9);
  setInk();
  doc.text(`50% deposit  ${formatMoney(deposit)} on confirmation`, M, y);
  doc.text(`Balance  ${formatMoney(balance)}  T-7 days`, M, y + 13);
  y += 30;

  if (quote.proximityMatch) {
    ensure(46);
    doc.setFillColor(240, 250, 252);
    doc.setDrawColor(180, 220, 230);
    doc.roundedRect(M, y, W - 2 * M, 40, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 110, 130);
    doc.text("ROUTING DISCOUNT APPLIED", M + 12, y + 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setMuted();
    doc.text(
      `Origin re-anchored via ${quote.proximityMatch.cityName} on ${quote.proximityMatch.date} — saves ${formatMoney(quote.proximityMatch.saved)}`,
      M + 12,
      y + 30,
    );
    y += 52;
  }

  // ============ Line groups ============
  const groups: { title: string; lines: { label: string; detail?: string; amount: number }[] }[] = [
    { title: "Performance", lines: quote.performanceLines },
    { title: "Travel & logistics", lines: quote.travelLines },
    ...(quote.discountLine ? [{ title: "Adjustments", lines: [quote.discountLine] }] : []),
    {
      title: "Platform",
      lines: [
        {
          label: `Booking commission (${quote.commissionPct}%)`,
          detail: "On performance fee only — travel passes through at cost.",
          amount: quote.commission,
        },
      ],
    },
  ];

  for (const g of groups) {
    heading(g.title);
    for (const l of g.lines) {
      ensure(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setInk();
      doc.text(l.label, M, y);
      doc.text(formatMoney(l.amount), W - M, y, { align: "right" });
      y += 12;
      if (l.detail) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        setMuted();
        const lines = doc.splitTextToSize(l.detail, W - 2 * M - 80);
        doc.text(lines, M, y);
        y += lines.length * 10;
      }
      y += 4;
    }
    y += 6;
  }

  ensure(30);
  line(y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setInk();
  doc.text("TOTAL QUOTE", M, y);
  doc.text(formatMoney(quote.total), W - M, y, { align: "right" });
  y += 24;

  // ============ Rider ============
  doc.addPage();
  y = M;
  heading("Hospitality & technical rider", 12);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  setMuted();
  doc.text(
    `Provided by promoter at the venue prior to artist arrival. Team of ${quote.crewSize}.`,
    M,
    y,
  );
  y += 16;
  for (const section of DEFAULT_RIDER) {
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setInk();
    doc.text(section.category.toUpperCase(), M, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setInk();
    for (const item of section.items) {
      ensure(14);
      doc.text(`•  ${item}`, M + 6, y);
      y += 12;
    }
    y += 6;
  }

  // ============ T&Cs ============
  doc.addPage();
  y = M;
  heading("Terms & conditions", 12);
  for (const c of DEFAULT_TERMS) {
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setInk();
    doc.text(`${c.n}.  ${c.title}`, M, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const b of c.body) {
      const lines = doc.splitTextToSize(b, W - 2 * M - 12);
      ensure(lines.length * 11 + 4);
      doc.text(lines, M + 12, y);
      y += lines.length * 11 + 4;
    }
    y += 6;
  }

  // ============ Banking ============
  ensure(120);
  y += 10;
  heading("Banking details", 12);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  setMuted();
  doc.text(
    "Off-platform reference. On the platform, deposit + balance flow through escrow.",
    M,
    y,
  );
  y += 16;
  const rows: [string, string][] = [
    ["Account name", BANKING.accountName],
    ["Bank", BANKING.bank],
    ["Type", BANKING.accountType],
    ["Account number", BANKING.accountNumber],
  ];
  for (const [k, v] of rows) {
    ensure(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setMuted();
    doc.text(k.toUpperCase(), M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    setInk();
    doc.text(v, M + 140, y);
    y += 18;
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setMuted();
    doc.text(`PENYA/BOOKINGS  ·  ${ref}  ·  page ${i} of ${pageCount}`, M, H - 20);
    doc.text("Generated by the quote engine · v1.0", W - M, H - 20, { align: "right" });
  }

  doc.save(`${ref}.pdf`);
}
