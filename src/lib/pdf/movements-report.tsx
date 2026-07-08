import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { LOGO_PNG_BASE64 } from "./logo-base64";
import type { Movement } from "@/lib/types";

// Embedded rather than read from public/ at runtime — Vercel serverless
// functions don't guarantee public/ assets exist on the function's
// filesystem, and a dynamically-built fs path can't be traced at build time.
const logoDataUri = `data:image/png;base64,${LOGO_PNG_BASE64}`;

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#18181b" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  logo: { width: 36, height: 36 },
  orgName: { fontSize: 13, fontWeight: 700 },
  orgSub: { fontSize: 8, color: "#6b7280" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 10 },
  subtitle: { fontSize: 9, color: "#6b7280", marginTop: 2, marginBottom: 12 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  summaryCard: {
    flexGrow: 1,
    flexBasis: 0,
    border: "1 solid #e9e9e5",
    borderRadius: 4,
    padding: 8,
  },
  summaryLabel: { fontSize: 7.5, color: "#6b7280", marginBottom: 3 },
  summaryValue: { fontSize: 12, fontWeight: 700 },
  table: { borderTop: "1 solid #d6d6d0", borderLeft: "1 solid #d6d6d0" },
  tr: { flexDirection: "row" },
  thRow: { backgroundColor: "#f7f7f5" },
  th: {
    padding: 4,
    fontSize: 7.5,
    fontWeight: 700,
    color: "#6b7280",
    borderRight: "1 solid #d6d6d0",
    borderBottom: "1 solid #d6d6d0",
  },
  td: {
    padding: 4,
    fontSize: 8,
    borderRight: "1 solid #d6d6d0",
    borderBottom: "1 solid #d6d6d0",
  },
  colDate: { width: "8%" },
  colType: { width: "13%" },
  colItem: { width: "19%" },
  colQty: { width: "6%", textAlign: "right" },
  colCost: { width: "10%", textAlign: "right" },
  colTotal: { width: "11%", textAlign: "right" },
  colWho: { width: "18%" },
  colStaff: { width: "15%" },
  signatures: { flexDirection: "row", gap: 24, marginTop: 36 },
  sigBlock: { flexGrow: 1, flexBasis: 0 },
  sigLine: { borderTop: "1 solid #18181b", marginBottom: 4, marginTop: 28 },
  sigLabel: { fontSize: 8, color: "#6b7280" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 7,
    color: "#9ca3af",
    textAlign: "center",
  },
});

// Standard PDF fonts (Helvetica) have no ₱ glyph — it silently falls back to
// "±". Spell the currency out instead of relying on the Unicode symbol.
const money = (n: number) => `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface MovementsReportInput {
  from: string;
  to: string;
  movements: Movement[];
  generatedBy: string;
}

export function MovementsReportDocument({ from, to, movements, generatedBy }: MovementsReportInput) {
  // Cancelled dispenses/sales stay listed for the audit trail but are
  // excluded from every total, same as the dashboard.
  const dispensed = movements.filter(
    (m) => (m.type === "DISPENSE" || m.type === "SALE") && !m.cancelledAt,
  );
  const totalQty = dispensed.reduce((s, m) => s + m.qty, 0);
  const totalCost = dispensed.reduce((s, m) => s + m.qty * m.unitCost, 0);
  const totalRevenue = movements
    .filter((m) => m.type === "SALE" && !m.cancelledAt)
    .reduce((s, m) => s + m.qty * (m.unitPrice ?? 0), 0);
  const received = movements.filter((m) => m.type === "RECEIVE");
  const receivedCost = received.reduce((s, m) => s + m.qty * m.unitCost, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image style={styles.logo} src={logoDataUri} />
          <View>
            <Text style={styles.orgName}>Northern Luzon Mission</Text>
            <Text style={styles.orgSub}>Inventory &amp; Dispensing System</Text>
          </View>
        </View>

        <Text style={styles.title}>Stock Movement Report</Text>
        <Text style={styles.subtitle}>
          {from} to {to} · generated {new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
        </Text>

        <View style={styles.summaryRow}>
          <SummaryCard label="Dispensed / sold (units)" value={String(totalQty)} />
          <SummaryCard label="Dispense cost" value={money(totalCost)} />
          <SummaryCard label="Sales revenue" value={money(totalRevenue)} />
          <SummaryCard label="Received (units / cost)" value={`${received.reduce((s, m) => s + m.qty, 0)} / ${money(receivedCost)}`} />
        </View>

        <View style={styles.table}>
          <View style={[styles.tr, styles.thRow]} fixed>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colType]}>Type</Text>
            <Text style={[styles.th, styles.colItem]}>Item</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colCost]}>Unit cost</Text>
            <Text style={[styles.th, styles.colTotal]}>Total cost</Text>
            <Text style={[styles.th, styles.colWho]}>Issued to</Text>
            <Text style={[styles.th, styles.colStaff]}>Staff</Text>
          </View>
          {movements.map((m) => (
            <View style={styles.tr} key={m.id} wrap={false}>
              <Text style={[styles.td, styles.colDate]}>
                {new Date(m.at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
              </Text>
              <Text style={[styles.td, styles.colType]}>
                {m.cancelledAt ? `${m.type} (CANCELLED)` : m.type}
              </Text>
              <Text style={[styles.td, styles.colItem]}>{m.itemName}</Text>
              <Text style={[styles.td, styles.colQty]}>{m.qty}</Text>
              <Text style={[styles.td, styles.colCost]}>{money(m.unitCost)}</Text>
              <Text style={[styles.td, styles.colTotal]}>{money(m.qty * m.unitCost)}</Text>
              <Text style={[styles.td, styles.colWho]}>{m.issuedTo ?? "—"}</Text>
              <Text style={[styles.td, styles.colStaff]}>{m.staff}</Text>
            </View>
          ))}
        </View>

        <View style={styles.signatures}>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine} />
            <Text style={styles.sigLabel}>Prepared by</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine} />
            <Text style={styles.sigLabel}>Checked by</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine} />
            <Text style={styles.sigLabel}>Approved by</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Prepared by {generatedBy} · Northern Luzon Mission Inventory System
        </Text>
      </Page>
    </Document>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}
