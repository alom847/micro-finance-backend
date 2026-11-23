// Forwards SMS requests to BSNL, which only accepts traffic from India.
// Callers must send `x-region: ap-south-1` so this runs in Mumbai.
const BSNL_URL = "https://bulksms.bsnl.in:5010/api/Send_SMS";
const REQUIRED_REGION = "ap-south-1";

const region = () => Deno.env.get("SB_REGION") ?? "unknown";

const json = (status: number, body: Record<string, unknown>) =>
  Response.json({ ...body, region: region() }, { status });

const digest = async (value: string) =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );

const isAuthorized = async (provided: string | null) => {
  const secret = Deno.env.get("SMS_RELAY_SECRET");
  if (!secret || !provided) return false;

  const [a, b] = await Promise.all([digest(provided), digest(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json(405, { status: false, message: "Method not allowed" });
  }

  if (!(await isAuthorized(req.headers.get("x-sms-relay-secret")))) {
    return json(401, { status: false, message: "Unauthorized" });
  }

  if (region() !== REQUIRED_REGION) {
    console.warn(`sms-relay running in ${region()}, expected ${REQUIRED_REGION}`);
  }

  const body = await req.json().catch(() => null);
  const { target, template_id, values = [] } = body ?? {};

  const valid =
    typeof target === "string" &&
    typeof template_id === "string" &&
    Array.isArray(values) &&
    // deno-lint-ignore no-explicit-any
    values.every((v: any) => v && typeof v.Key === "string" && v.Value != null);

  if (!valid) return json(400, { status: false, message: "Invalid payload" });

  try {
    const resp = await fetch(BSNL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("BRPS_ACCESS_TOKEN")}`,
      },
      body: JSON.stringify({
        Header: Deno.env.get("HEADER"),
        Target: target,
        Is_Unicode: "0",
        Is_Flash: "0",
        Message_Type: "SI",
        Entity_Id: Deno.env.get("ENTITY_Id"),
        Content_Template_Id: template_id,
        Consent_Template_Id: null,
        Template_Keys_and_Values: values,
      }),
      signal: AbortSignal.timeout(12000),
    });

    const text = await resp.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // BSNL replied with something other than JSON; pass it through as text.
    }

    if (!resp.ok) {
      console.error(`BSNL returned HTTP ${resp.status}`);
      return json(502, {
        status: false,
        message: "SMS provider rejected the request",
        provider_status: resp.status,
        data,
      });
    }

    return json(200, { status: true, data });
  } catch (e) {
    // Do not log the payload: it can contain OTPs and passwords.
    console.error("BSNL request failed:", e instanceof Error ? e.message : e);
    return json(502, { status: false, message: "Could not reach SMS provider" });
  }
});
