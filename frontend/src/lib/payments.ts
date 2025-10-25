export type CardTokenPayload = {
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvn: string;
  amount?: number;
  cardholderName?: string;
  email?: string;
};

export type CardTokenResponse = {
  id: string;
  status?: string;
  card_brand?: string;
  card_info?: {
    brand?: string;
  };
  verification_url?: string;
  masked_card_number?: string;
};

const encodeBasicAuth = (key: string) => {
  if (typeof btoa === "function") {
    return btoa(`${key}:`);
  }
  throw new Error("Browser base64 encoding is not available");
};

const getXenditBaseURL = () => {
  const configured = process.env.NEXT_PUBLIC_XENDIT_API_URL;
  if (configured && configured.trim() !== "") {
    return configured.replace(/\/$/, "");
  }
  return "https://api.xendit.co";
};

export async function createCardToken(
  payload: CardTokenPayload,
): Promise<CardTokenResponse> {
  const publicKey = process.env.NEXT_PUBLIC_XENDIT_PUBLIC_KEY;
  if (!publicKey || publicKey.trim() === "") {
    throw new Error("Xendit public key is not configured.");
  }

  const body: Record<string, unknown> = {
    card_number: payload.cardNumber,
    card_exp_month: payload.expMonth,
    card_exp_year: payload.expYear,
    card_cvn: payload.cvn,
    is_multiple_use: false,
    should_authenticate: true,
  };

  if (typeof payload.amount === "number" && payload.amount > 0) {
    body.amount = Math.round(payload.amount);
  }

  if (payload.cardholderName) {
    body.cardholder_name = payload.cardholderName;
  }

  if (payload.email) {
    body.email = payload.email;
  }

  const response = await fetch(`${getXenditBaseURL()}/credit_card_tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${encodeBasicAuth(publicKey)}`,
    },
    body: JSON.stringify(body),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch (error) {
    // ignore json parse error
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.message_error ||
      "Failed to create card token.";
    throw new Error(message);
  }

  if (!data || typeof data.id !== "string") {
    throw new Error("Card token response is invalid.");
  }

  return data as CardTokenResponse;
}
