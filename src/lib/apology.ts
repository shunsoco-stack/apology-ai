export type ApologyMode = "normal" | "polite" | "super";

export type Recipient = "friend" | "partner" | "boss" | "family" | "stranger";

export const MODES = [
  {
    id: "normal",
    label: "通常",
    description: "まずは、素直なひと言。",
    text: "すみませんでした",
  },
  {
    id: "polite",
    label: "丁寧",
    description: "語彙を増やして、深く反省。",
    text: "大変申し訳ございませんでした",
  },
  {
    id: "super",
    label: "超高性能",
    description: "持てるすべての語彙を、謝罪へ。",
    text: "このたびは誠に申し訳ございませんでした",
  },
] as const satisfies ReadonlyArray<{
  id: ApologyMode;
  label: string;
  description: string;
  text: string;
}>;

export const RECIPIENTS = [
  { id: "friend", label: "友人" },
  { id: "partner", label: "恋人" },
  { id: "boss", label: "上司" },
  { id: "family", label: "家族" },
  { id: "stranger", label: "知らない人" },
] as const satisfies ReadonlyArray<{ id: Recipient; label: string }>;

export const PROCESSING_STEPS = [
  "状況を分析中",
  "責任の所在を確認中",
  "言い訳を削除中",
  "謝罪を生成中",
] as const;

export function isApologyMode(value: unknown): value is ApologyMode {
  return value === "normal" || value === "polite" || value === "super";
}

export function isRecipient(value: unknown): value is Recipient {
  return RECIPIENTS.some((recipient) => recipient.id === value);
}

/** Intentionally accepts no situation or personal information. No AI API is used. */
export function generateApology(mode: ApologyMode): string {
  switch (mode) {
    case "polite":
      return MODES[1].text;
    case "super":
      return MODES[2].text;
    default:
      return MODES[0].text;
  }
}
