import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { LOGO_PNG_BASE64 } from "./logo-base64";
import { MOVEMENT_LABELS, type Movement } from "@/lib/types";

const logoDataUri = `data:image/png;base64,${LOGO_PNG_BASE64}`;

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#18181b" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  logo: { width: 36, height: 36 },
  orgName: { fontSize: 13, fontWeight: 700 },
  orgSub: { fontSize: 8, color: "#6b7280" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 10 },
  subtitle: { fontSize: 9, color: "#6b7280", marginTop: 2, marginBottom: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottom: "1 solid #e9e9e5",
  },
  label: { color: "#6b7280" },
  value: { fontWeight: 400 },
  strong: { fontWeight: 700 },
  sigSection: { marginTop: 30 },
  sigLabel: { fontSize: 9, color: "#6b7280", marginBottom: 6 },
  sigImage: { width: 200, height: 80, objectFit: "contain" },
  sigLine: { borderTop: "1 solid #18181b", marginTop: 4, width: 200 },
  sigName: { fontSize: 8, color: "#6b7280", marginTop: 4 },
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

const money = (n: number) =>
  `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface MovementReceiptInput {
  movement: Movement;
  signature: string;
}

export function MovementReceiptDocument({ movement, signature }: MovementReceiptInput) {
  const totalCost = movement.qty * movement.unitCost;
  const totalAmount = movement.unitPrice !== undefined ? movement.qty * movement.unitPrice : undefined;

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

        <Text style={styles.title}>Movement Receipt — {MOVEMENT_LABELS[movement.type] ?? movement.type}</Text>
        <Text style={styles.subtitle}>
          {movement.itemName} · {movement.shelf} · {movement.location}
        </Text>

        <View>
          <View style={styles.row}>
            <Text style={styles.label}>Quantity</Text>
            <Text style={styles.value}>
              {movement.qty} {movement.unit}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Unit cost</Text>
            <Text style={styles.value}>{money(movement.unitCost)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Total cost</Text>
            <Text style={styles.strong}>{money(totalCost)}</Text>
          </View>
          {movement.unitPrice !== undefined && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Unit price</Text>
                <Text style={styles.value}>{money(movement.unitPrice)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Total amount</Text>
                <Text style={styles.strong}>{money(totalAmount!)}</Text>
              </View>
            </>
          )}
          {movement.orNumber && (
            <View style={styles.row}>
              <Text style={styles.label}>OR number</Text>
              <Text style={styles.value}>{movement.orNumber}</Text>
            </View>
          )}
          {movement.purpose && (
            <View style={styles.row}>
              <Text style={styles.label}>Purpose</Text>
              <Text style={styles.value}>{movement.purpose.replaceAll("_", " ")}</Text>
            </View>
          )}
          {movement.issuedTo && (
            <View style={styles.row}>
              <Text style={styles.label}>Issued to</Text>
              <Text style={styles.value}>{movement.issuedTo}</Text>
            </View>
          )}
          {movement.reference && (
            <View style={styles.row}>
              <Text style={styles.label}>Reference</Text>
              <Text style={styles.value}>{movement.reference}</Text>
            </View>
          )}
          {movement.note && (
            <View style={styles.row}>
              <Text style={styles.label}>Note</Text>
              <Text style={styles.value}>{movement.note}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Staff</Text>
            <Text style={styles.value}>{movement.staff}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>
              {new Date(movement.at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
            </Text>
          </View>
        </View>

        <View style={styles.sigSection}>
          <Text style={styles.sigLabel}>Signature of person who availed</Text>
          <Image style={styles.sigImage} src={signature} />
          <View style={styles.sigLine} />
          <Text style={styles.sigName}>{movement.issuedTo ?? movement.staff}</Text>
        </View>

        <Text style={styles.footer} fixed>
          Northern Luzon Mission Inventory System
        </Text>
      </Page>
    </Document>
  );
}
