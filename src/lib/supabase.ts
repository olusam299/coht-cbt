import { createClient } from "@supabase/supabase-js";
import { getDeviceId } from "./device";
import { assertSecureApiUrl } from "./transport-security";

const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'];
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY");
}

// OTPs and answers travel to this address: it must be https.
assertSecureApiUrl(supabaseUrl, import.meta.env.DEV);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    // Database calls carry this browser's id so a student's registration number
    // cannot be active on two devices at once.
    fetch: (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes("/rest/v1/")) return fetch(input, init);
      const headers = new Headers(init?.headers);
      headers.set("x-device-id", getDeviceId());
      return fetch(input, { ...init, headers });
    },
  },
});