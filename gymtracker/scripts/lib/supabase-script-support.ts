import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadLocalEnvFiles() {
  const envFilePaths = [".env.local", ".env"].map((fileName) =>
    resolve(process.cwd(), fileName),
  );

  for (const filePath of envFilePaths) {
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");

      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export function getArgumentValue(flag: string) {
  const index = process.argv.findIndex((argument) => argument === flag);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

export function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

export function readScriptCredentials() {
  return {
    email: getArgumentValue("--email") ?? process.env.SUPABASE_USER_EMAIL ?? "",
    password:
      getArgumentValue("--password") ?? process.env.SUPABASE_USER_PASSWORD ?? "",
  };
}

export async function createAuthenticatedSupabaseClient(input: {
  email: string;
  password: string;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const signInResult = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (signInResult.error || !signInResult.data.user) {
    throw new Error(signInResult.error?.message ?? "Unable to sign in");
  }

  return {
    supabase,
    user: signInResult.data.user,
  };
}

export function buildDisplayName(input: {
  name: string;
  modality: string | null;
}) {
  return input.modality ? `${input.name} (${input.modality})` : input.name;
}
