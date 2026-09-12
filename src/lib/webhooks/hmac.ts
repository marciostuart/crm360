import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_SECONDS = 300;

export type SignatureHeaders = {
  timestamp: string | null;
  nonce: string | null;
  signature: string | null;
};

export function signLeadPayload(rawBody: string, timestamp: string, nonce: string, secret: string): string {
  const message = `${timestamp}.${nonce}.${rawBody}`;
  return `sha256=${createHmac("sha256", secret).update(message).digest("hex")}`;
}

export function verifyLeadSignature(
  rawBody: string,
  headers: SignatureHeaders,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!headers.timestamp || !headers.nonce || !headers.signature) return false;
  if (!/^\d{10}$/.test(headers.timestamp)) return false;
  const timestamp = Number(headers.timestamp);
  if (Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) return false;

  const expected = signLeadPayload(rawBody, headers.timestamp, headers.nonce, secret);
  const received = headers.signature;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
