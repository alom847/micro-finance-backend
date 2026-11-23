// Temporary diagnostic: reports the outbound IP that BSNL would see.
// Delete once the relay is confirmed working.
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
  if (!(await isAuthorized(req.headers.get("x-sms-relay-secret")))) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const region = Deno.env.get("SB_REGION") ?? "unknown";

  try {
    const resp = await fetch("https://ipinfo.io/json", {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`ipinfo returned HTTP ${resp.status}`);

    const { ip, country, city, org } = await resp.json();
    return Response.json({ region, ip, country, city, org });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ region, message }, { status: 502 });
  }
});
