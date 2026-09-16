import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type LookInput = {
  image: string;
  styleLabel?: string;
  colorLabel?: string;
};

export type LookRecord = {
  token: string;
  storagePath: string;
  styleLabel?: string;
  colorLabel?: string;
  createdAt: string;
  expiresAt: string;
  status: "active" | "expired";
  image?: string;
};

const bucket = process.env.SUPABASE_LOOKS_BUCKET || "hair-results";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseKey);

function expiryDate() {
  const minutes = Number(process.env.RESULT_EXPIRY_MINUTES || 60);
  return new Date(Date.now() + Math.max(5, minutes) * 60_000);
}

function decodeImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Only base64 image uploads are supported");
  return {
    contentType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

function requireSupabase() {
  if (!supabaseUrl || !supabaseKey)
    throw new Error("Supabase is not configured");
  return { url: supabaseUrl.replace(/\/$/, ""), key: supabaseKey };
}

async function supabaseRequest(endpoint: string, init: RequestInit = {}) {
  const { url, key } = requireSupabase();
  return fetch(`${url}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      ...(init.headers || {}),
    },
  });
}

export async function createLook(input: LookInput) {
  const image = decodeImage(input.image);
  const token = crypto.randomBytes(24).toString("hex");
  const createdAt = new Date();
  const expiresAt = expiryDate();
  const record: LookRecord = {
    token,
    storagePath: `looks/${token}.jpg`,
    styleLabel: input.styleLabel,
    colorLabel: input.colorLabel,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: "active",
  };

  if (useSupabase) {
    const upload = await supabaseRequest(
      `/storage/v1/object/${bucket}/${record.storagePath}`,
      {
        method: "POST",
        headers: { "Content-Type": image.contentType, "x-upsert": "false" },
        body: image.bytes,
      },
    );
    if (!upload.ok) throw new Error("Unable to store hairstyle image");
    const insert = await supabaseRequest("/rest/v1/hair_results", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        result_token: record.token,
        storage_path: record.storagePath,
        style_label: record.styleLabel,
        color_label: record.colorLabel,
        created_at: record.createdAt,
        expires_at: record.expiresAt,
        status: record.status,
      }),
    });
    if (!insert.ok) {
      await supabaseRequest(
        `/storage/v1/object/${bucket}/${record.storagePath}`,
        {
          method: "DELETE",
        },
      );
      throw new Error("Unable to create hairstyle result record");
    }
  } else {
    const directory = path.join(process.cwd(), ".data", "look-sessions");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
      path.join(directory, `${token}.json`),
      JSON.stringify({ ...record, image: input.image }),
      "utf8",
    );
  }

  return record;
}

async function removeExpired(record: LookRecord) {
  if (useSupabase) {
    await supabaseRequest(
      `/rest/v1/hair_results?result_token=eq.${encodeURIComponent(record.token)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "expired" }),
      },
    );
    await supabaseRequest(
      `/storage/v1/object/${bucket}/${record.storagePath}`,
      { method: "DELETE" },
    );
  } else {
    await fs.rm(
      path.join(
        process.cwd(),
        ".data",
        "look-sessions",
        `${record.token}.json`,
      ),
      { force: true },
    );
  }
}

export async function getLook(token: string) {
  let record: LookRecord | null = null;
  if (useSupabase) {
    const response = await supabaseRequest(
      `/rest/v1/hair_results?result_token=eq.${encodeURIComponent(token)}&select=result_token,storage_path,style_label,color_label,created_at,expires_at,status&limit=1`,
    );
    const rows = response.ok
      ? ((await response.json()) as Array<Record<string, string>>)
      : [];
    const row = rows[0];
    if (row) {
      record = {
        token: row.result_token,
        storagePath: row.storage_path,
        styleLabel: row.style_label,
        colorLabel: row.color_label,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        status: row.status as LookRecord["status"],
      };
    }
  } else {
    try {
      record = JSON.parse(
        await fs.readFile(
          path.join(process.cwd(), ".data", "look-sessions", `${token}.json`),
          "utf8",
        ),
      ) as LookRecord;
    } catch {
      record = null;
    }
  }

  if (
    !record ||
    record.status !== "active" ||
    Date.now() >= Date.parse(record.expiresAt)
  ) {
    if (record) await removeExpired(record);
    return null;
  }
  return record;
}

export async function getLookImage(record: LookRecord) {
  if (record.image)
    return {
      bytes: Buffer.from(record.image.split(",")[1], "base64"),
      contentType: "image/jpeg",
    };
  const signed = await supabaseRequest(
    `/storage/v1/object/sign/${bucket}/${record.storagePath}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 300 }),
    },
  );
  if (!signed.ok) throw new Error("Unable to retrieve hairstyle image");
  const data = (await signed.json()) as { signedURL?: string };
  if (!data.signedURL) throw new Error("Unable to retrieve hairstyle image");
  const { url } = requireSupabase();
  const image = await fetch(`${url}/storage/v1${data.signedURL}`);
  if (!image.ok) throw new Error("Unable to retrieve hairstyle image");
  return {
    bytes: Buffer.from(await image.arrayBuffer()),
    contentType: image.headers.get("content-type") || "image/jpeg",
  };
}

export async function cleanupExpiredLooks() {
  const now = new Date().toISOString();
  if (useSupabase) {
    const response = await supabaseRequest(
      `/rest/v1/hair_results?expires_at=lt.${encodeURIComponent(now)}&status=eq.active&select=result_token,storage_path`,
    );
    if (!response.ok) throw new Error("Unable to find expired looks");
    const rows = (await response.json()) as Array<{
      result_token: string;
      storage_path: string;
    }>;
    for (const row of rows) {
      await supabaseRequest(
        `/storage/v1/object/${bucket}/${row.storage_path}`,
        { method: "DELETE" },
      );
    }
    if (rows.length) {
      await supabaseRequest(
        `/rest/v1/hair_results?expires_at=lt.${encodeURIComponent(now)}&status=eq.active`,
        {
          method: "DELETE",
        },
      );
    }
    return rows.length;
  }

  const directory = path.join(process.cwd(), ".data", "look-sessions");
  let removed = 0;
  try {
    const files = await fs.readdir(directory);
    for (const file of files.filter((name) => name.endsWith(".json"))) {
      try {
        const record = JSON.parse(
          await fs.readFile(path.join(directory, file), "utf8"),
        ) as LookRecord;
        if (Date.now() >= Date.parse(record.expiresAt)) {
          await fs.rm(path.join(directory, file), { force: true });
          removed += 1;
        }
      } catch {
        // Ignore a file that is being written or is not a look record.
      }
    }
  } catch {
    return 0;
  }
  return removed;
}
