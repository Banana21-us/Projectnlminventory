import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { LOGO_PNG_BASE64 } from "./logo-base64";
import { CATEGORY_LABELS, type CountSheetRow } from "@/lib/types";

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
  colItem: { width: "22%" },
  colCategory: { width: "10%" },
  colShelf: { width: "7%" },
  colLocation: { width: "12%" },
  colQty: { width: "8%", textAlign: "right" },
  colEnding: { width: "11%", textAlign: "right" },
  colCount: { width: "14%" },
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

export interface CountSheetReportInput {
  rows: CountSheetRow[];
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  generatedBy: string;
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { dateStyle: "medium" });
}

export function CountSheetDocument({ rows, from, to, generatedBy }: CountSheetReportInput) {
  const sorted = [...rows].sort(
    (a, b) => a.location.localeCompare(b.location) || a.name.localeCompare(b.name),
  );

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

        <Text style={styles.title}>Inventory Count Sheet</Text>
        <Text style={styles.subtitle}>
          {longDate(from)} — {longDate(to)} · generated{" "}
          {new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
        </Text>

        <View style={styles.table}>
          <View style={[styles.tr, styles.thRow]} fixed>
            <Text style={[styles.th, styles.colItem]}>Item</Text>
            <Text style={[styles.th, styles.colCategory]}>Category</Text>
            <Text style={[styles.th, styles.colShelf]}>Shelf</Text>
            <Text style={[styles.th, styles.colLocation]}>Location</Text>
            <Text style={[styles.th, styles.colQty]}>Beginning</Text>
            <Text style={[styles.th, styles.colQty]}>In</Text>
            <Text style={[styles.th, styles.colQty]}>Out</Text>
            <Text style={[styles.th, styles.colEnding]}>Ending</Text>
            <Text style={[styles.th, styles.colCount]}>Physical count</Text>
          </View>
          {sorted.map((row) => (
            <View style={styles.tr} key={row.id} wrap={false}>
              <Text style={[styles.td, styles.colItem]}>{row.name}</Text>
              <Text style={[styles.td, styles.colCategory]}>{CATEGORY_LABELS[row.category]}</Text>
              <Text style={[styles.td, styles.colShelf]}>{row.shelf}</Text>
              <Text style={[styles.td, styles.colLocation]}>{row.location}</Text>
              <Text style={[styles.td, styles.colQty]}>{row.beginning}</Text>
              <Text style={[styles.td, styles.colQty]}>{row.inQty}</Text>
              <Text style={[styles.td, styles.colQty]}>{row.outQty}</Text>
              <Text style={[styles.td, styles.colEnding]}>
                {row.ending} {row.unit}
              </Text>
              <Text style={[styles.td, styles.colCount]}> </Text>
            </View>
          ))}
        </View>

        <View style={styles.signatures}>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine} />
            <Text style={styles.sigLabel}>Counted by</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.sigLine} />
            <Text style={styles.sigLabel}>Verified by</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Generated by {generatedBy} · Northern Luzon Mission Inventory System
        </Text>
      </Page>
    </Document>
  );
}
