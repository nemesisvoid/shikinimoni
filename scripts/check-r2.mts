/**
 * npm run storage:check  (.mts so top-level await works)
 *
 * Verifies the R2 setup end to end, the same way the app uploads:
 *  - media bucket: signed upload, API check, readable at the public URL, delete
 *  - documents bucket: signed upload, API check, readable ONLY via a signed link, delete
 * Browser CORS can only be checked from the app (or with a preflight request).
 */
process.loadEnvFile(".env.local");

const { createDownloadUrl, createUploadUrl, deleteObjects, getObjectInfo, isStorageConfigured, publicUrlFor } =
  await import("../lib/storage/r2");
type Kind = "media" | "documents";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let failed = false;
function step(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failed = true;
  return ok;
}

async function check(kind: Kind) {
  console.log(`\n${kind === "media" ? "Photos" : "Documents"} bucket (${kind === "media" ? "R2_BUCKET" : "R2_DOCUMENTS_BUCKET"})`);
  if (!step("Configured", isStorageConfigured(kind), isStorageConfigured(kind) ? "" : "fill the R2_* variables in .env.local")) return;

  const key = `properties/_healthcheck/${Date.now()}.png`;
  const url = await createUploadUrl(kind, { key, contentType: "image/png", sizeBytes: PNG.length });
  const put = await fetch(url, { method: "PUT", body: PNG, headers: { "Content-Type": "image/png" } });
  if (!step("Upload with a signed URL", put.ok, put.ok ? "" : `${put.status} ${await put.text()}`)) return;

  const info = await getObjectInfo(kind, key);
  step("Object visible to the API", info?.sizeBytes === PNG.length, JSON.stringify(info));

  if (kind === "media") {
    const pub = await fetch(publicUrlFor(key));
    step("Readable at R2_PUBLIC_URL", pub.ok, pub.ok ? "" : `${pub.status} (is public access on?)`);
  } else {
    const signed = await fetch(await createDownloadUrl(kind, key, { fileName: "check.png" }));
    step("Readable with a signed download link", signed.ok, signed.ok ? "" : String(signed.status));
  }

  await deleteObjects(kind, [key]);
  step("Deleted again", (await getObjectInfo(kind, key)) === null);
}

await check("media");
await check("documents");

console.log(
  failed
    ? "\nSomething isn't set up yet; see the ✗ lines above."
    : "\nR2 is ready. Keep public access OFF on the documents bucket, and add the CORS rule to both buckets.",
);
process.exit(failed ? 1 : 0);
