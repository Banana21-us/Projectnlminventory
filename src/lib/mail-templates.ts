export interface DispenseMailInput {
  recipientName: string;
  itemName: string;
  qty: number;
  unit: string;
  staffName: string;
  at: Date;
  orNumber?: string;
  unitPrice?: number;
}

export function dispenseNoticeMail(input: DispenseMailInput) {
  const dateStr = input.at.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
  const isSale = input.unitPrice !== undefined;
  const lines = [
    `Hello ${input.recipientName},`,
    "",
    isSale
      ? `You were issued ${input.qty} ${input.unit} of "${input.itemName}" (sold${
          input.orNumber ? `, OR# ${input.orNumber}` : ""
        }).`
      : `You were issued ${input.qty} ${input.unit} of "${input.itemName}".`,
    `Date: ${dateStr}`,
    `Issued by: ${input.staffName}`,
    "",
    "— Northern Luzon Mission Inventory System",
  ];

  return {
    subject: `Dispense notice: ${input.itemName}`,
    text: lines.join("\n"),
  };
}
