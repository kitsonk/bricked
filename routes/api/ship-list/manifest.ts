import { stringify } from "@std/csv";
import { define } from "@/utils/fresh.ts";
import type { AusPostAddress } from "@/utils/types.ts";

interface ManifestRow {
  orderId: number;
  countryCode: string;
  address: AusPostAddress;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
  extraCover: string;
}

const COLUMNS = [
  "Send From Name",
  "Send From Address Line 1",
  "Send From Suburb",
  "Send From State",
  "Send From Postcode",
  "Deliver To Name",
  "Deliver To Address Line 1",
  "Deliver To Address Line 2",
  "Deliver To Suburb",
  "Deliver To State",
  "Deliver To Postcode",
  "Item Packaging Type",
  "Item Delivery Service",
  "Item Length",
  "Item Width",
  "Item Height",
  "Item Weight",
  "Extra Cover Amount",
];

export const handler = define.handlers({
  async POST(ctx) {
    const rows: ManifestRow[] = await ctx.req.json();

    const auRows = rows.filter((r) => r.countryCode === "AU");

    const data = auRows.map((r) => ({
      "Send From Name": "Simon Burrows",
      "Send From Address Line 1": "U1/4 Plummer Court",
      "Send From Suburb": "MENTONE",
      "Send From State": "VIC",
      "Send From Postcode": "3194",
      "Deliver To Name": r.address.recipientName,
      "Deliver To Address Line 1": r.address.addressLine1.slice(0, 40),
      "Deliver To Address Line 2": r.address.addressLine2.slice(0, 40),
      "Deliver To Suburb": r.address.suburb.toUpperCase(),
      "Deliver To State": r.address.state.toUpperCase(),
      "Deliver To Postcode": r.address.postcode,
      "Item Packaging Type": "OWN_PACKAGING",
      "Item Delivery Service": "PP",
      "Item Length": r.lengthCm,
      "Item Width": r.widthCm,
      "Item Height": r.heightCm,
      "Item Weight": r.weightKg,
      "Extra Cover Amount": r.extraCover,
    }));

    const csv = stringify(data, { columns: COLUMNS });

    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${
      String(now.getDate()).padStart(2, "0")
    }`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="auspost-manifest-${date}.csv"`,
      },
    });
  },
});
