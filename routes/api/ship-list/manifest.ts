import { stringify } from "@std/csv";
import { define } from "@/utils/fresh.ts";
import type { AusPostAddress } from "@/utils/types.ts";

interface ManifestRow {
  orderId: number;
  buyerEmail: string;
  countryCode: string;
  address: AusPostAddress;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
  extraCover: string;
}

const COLUMNS = [
  "Recipient contact name",
  "Recipient address line 1",
  "Recipient address line 2",
  "Recipient address line 3",
  "Recipient suburb",
  "Recipient state",
  "Recipient postcode",
  "Recipient email address",
  "Product id",
  "Weight",
  "Authority to leave",
  "Sender reference 1",
  "Length",
  "Width",
  "Height",
  "Parcel contents",
  "Transit cover value",
];

export const handler = define.handlers({
  async POST(ctx) {
    const rows: ManifestRow[] = await ctx.req.json();

    const auRows = rows.filter((r) => r.countryCode === "AU");

    const data = auRows.map((r) => ({
      "Recipient contact name": r.address.recipientName,
      "Recipient address line 1": r.address.addressLine1.slice(0, 40),
      "Recipient address line 2": r.address.addressLine2.slice(0, 40),
      "Recipient address line 3": r.address.addressLine3.slice(0, 40),
      "Recipient suburb": r.address.suburb,
      "Recipient state": r.address.state.toUpperCase(),
      "Recipient postcode": r.address.postcode,
      "Recipient email address": r.address.recipientEmail || r.buyerEmail,
      "Product id": "PPAS",
      "Weight": r.weightKg,
      "Authority to leave": "Y",
      "Sender reference 1": `#${r.orderId}`,
      "Length": r.lengthCm,
      "Width": r.widthCm,
      "Height": r.heightCm,
      "Parcel contents": "Toy parts",
      "Transit cover value": r.extraCover,
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
