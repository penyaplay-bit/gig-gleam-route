import { jsPDF } from "jspdf";
import {
  formatCents,
  expandRider,
  type ArtistProfileConfig,
  type QuoteResult,
} from "./artist-engine";

const GOLD: [number, number, number] = [212, 175, 85];
const INK: [number, number, number] = [22, 22, 28];
const MUTED: [number, number, number] = [110, 110, 118];
const RULE: [number, number, number] = [220, 220, 224];

function ref(profileName: string, city: string | undefined, date: string): string {
  const clean = date.replace(/-/g, "");
  const artist = profileName.replace(/[^A-Z]/gi, "").slice(0, 2).toUpperCase();
  const cityCode = (city ?? "XX").replace(/[^A-Z]/gi, "").slice(0, 4).toUpperCase() || "XX";
  return `${artist}-${cityCode}-${clean}`;
}

export function downloadArtistQuotePdf(profile: ArtistProfileConfig, quote: QuoteResult) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  const inputs = quote.inputs;
  const quoteRef = ref(profile.name, inputs.city, inputs.event_date);

  const setInk = () => doc.setTextColor(...INK);
  const setMuted = () => doc.setTextColor(...MUTED);
  const line = (yy: number) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.5);
    doc.line(M, yy, W - M, yy);
  };
  const ensure = (need: number) => {
    if (y + need > H - M) { doc.addPage(); y = M; }
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
  doc.text("PENYA PLAY PRODUCTIONS", M + 46, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 205);
  doc.text("Media & Entertainment", M + 46, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text(`REF · ${quoteRef}`, W - M, 46, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 205);
  doc.text(new Date().toISOString().slice(0, 10), W - M, 60, { align: "right" });

  y = 120;
  setInk();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("QUOTATION", M, y);
  y += 24;

  // ============ Event details ============
  heading("Event Details");
  const details: [string, string][] = [
    ["Event", inputs.event_name || "—"],
    ["Date", inputs.event_date],
    ["Venue", inputs.venue || "—"],
    ["Location", [inputs.city, inputs.country].filter(Boolean).join(", ")],
    ["Attendance", inputs.attendance ? String(inputs.attendance) : "—"],
    ["Artist", profile.name],
  ];
  for (const [k, v] of details) {
    ensure(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setMuted();
    doc.text(k.toUpperCase(), M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setInk();
    doc.text(v, M + 120, y);
    y += 14;
  }
  y += 6;

  // ============ Total banner ============
  ensure(80);
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
  doc.text(formatCents(quote.total, quote.currency), M + 16, y + 48);
  setMuted();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (quote.distance) {
    doc.text(`${quote.distance.km} km · ${quote.distance.band}`, W - M - 16, y + 26, { align: "right" });
  }
  doc.text(`Team of ${quote.team_size}`, W - M - 16, y + 40, { align: "right" });
  y += 84;

  // ============ Financial breakdown ============
  heading("Financial Breakdown");
  for (const l of quote.lines) {
    ensure(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setInk();
    doc.text(l.label, M, y);
    doc.text(formatCents(l.amount, quote.currency), W - M, y, { align: "right" });
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

  ensure(30);
  line(y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setInk();
  doc.text("TOTAL PAYABLE", M, y);
  doc.text(formatCents(quote.total, quote.currency), W - M, y, { align: "right" });
  y += 24;

  // ============ Payment schedule ============
  heading("Payment Schedule");
  for (const p of quote.payment_schedule) {
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setInk();
    doc.text(p.label, M, y);
    doc.text(formatCents(p.amount, quote.currency), W - M, y, { align: "right" });
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setMuted();
    doc.text(`${p.condition} · due ${p.due_date}`, M, y);
    y += 16;
  }

  // ============ Rider ============
  doc.addPage();
  y = M;
  heading("Hospitality & Technical Rider", 12);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  setMuted();
  doc.text(`Provided by promoter prior to artist arrival. Team of ${quote.team_size}.`, M, y);
  y += 16;
  for (const section of expandRider(profile, quote.team_size)) {
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setInk();
    doc.text(section.title.toUpperCase(), M, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const it of section.items) {
      ensure(14);
      const label = `•  ${it.label} × ${it.qty}${it.note ? ` — ${it.note}` : ""}`;
      const lines = doc.splitTextToSize(label, W - 2 * M - 6);
      doc.text(lines, M + 6, y);
      y += lines.length * 12;
    }
    y += 6;
  }

  // ============ Terms ============
  doc.addPage();
  y = M;
  heading("Terms & Conditions", 12);
  const termsOrder: Array<[string, string]> = [
    ["1. Payment Terms",
      `Logistics costs (${formatCents(quote.logistics_total, quote.currency)}) are payable in full upon booking confirmation. Performance fee is split ${profile.payment_terms.booking_fee_pct}/${profile.payment_terms.final_fee_pct} — first installment upon confirmation, final installment latest ${profile.payment_terms.final_days_before_event} days before the event date.`],
    ["2. Cancellation — Weather / Force Majeure", profile.cancellation_terms.weather_force_majeure ?? ""],
    ["3. Cancellation — Artist Fault", profile.cancellation_terms.artist_fault ?? ""],
    ["4. Cancellation — Promoter Fault", profile.cancellation_terms.promoter_fault ?? ""],
    ["5. Rider Compliance", profile.cancellation_terms.rider_compliance ?? ""],
  ];
  for (const [title, body] of termsOrder) {
    if (!body) continue;
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setInk();
    doc.text(title, M, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(body, W - 2 * M - 12);
    ensure(lines.length * 11 + 4);
    doc.text(lines, M + 12, y);
    y += lines.length * 11 + 10;
  }

  // ============ Banking ============
  ensure(120);
  y += 6;
  heading("Banking Details", 12);
  const rows: [string, string][] = [
    ["Account name", profile.banking.account_name ?? ""],
    ["Bank", profile.banking.bank ?? ""],
    ["Account type", profile.banking.account_type ?? ""],
    ["Account number", profile.banking.account_number ?? ""],
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

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setMuted();
    doc.text(`PENYA PLAY PRODUCTIONS  ·  ${quoteRef}  ·  page ${i} of ${pageCount}`, M, H - 20);
    doc.text("Artist Pricing Engine · v1.0", W - M, H - 20, { align: "right" });
  }

  doc.save(`${quoteRef}.pdf`);
}
