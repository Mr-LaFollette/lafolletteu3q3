import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

function samePassword(given, real) {
  const a = createHash("sha256").update(String(given)).digest();
  const b = createHash("sha256").update(String(real)).digest();
  return timingSafeEqual(a, b);
}

export default async (req) => {
  const real = Netlify.env.get("ADMIN_PASSWORD");
  if (!real) {
    return json({ error: "ADMIN_PASSWORD is not set. Add it under Project configuration → Environment variables, then trigger a new deploy." }, 500);
  }
  if (!samePassword(req.headers.get("x-admin-password") || "", real)) {
    return json({ error: "Wrong password." }, 401);
  }

  const store = getStore("unit3-sessions");

  if (req.method === "DELETE") {
    const body = await req.json().catch(() => ({}));
    if (body.all === true && body.confirm === "DELETE") {
      const { deletedBlobs } = await store.deleteAll();
      return json({ ok: true, deleted: deletedBlobs });
    }
    if (Array.isArray(body.ids) && body.ids.length) {
      const ids = body.ids.filter((id) => typeof id === "string" && /^[a-z0-9-]{8,64}$/i.test(id)).slice(0, 500);
      await Promise.all(ids.map((id) => store.delete(id)));
      return json({ ok: true, deleted: ids.length });
    }
    return json({ error: "Nothing to delete." }, 400);
  }

  const { blobs } = await store.list();
  const sessions = [];
  for (let i = 0; i < blobs.length; i += 25) {
    const chunk = await Promise.all(blobs.slice(i, i + 25).map((b) => store.get(b.key, { type: "json" })));
    sessions.push(...chunk.filter(Boolean));
  }
  return json({ sessions });
};

export const config = { path: "/api/admin", method: ["GET", "DELETE"] };
