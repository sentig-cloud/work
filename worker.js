export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/save") {
      const data = await request.json();

      await env.WORK_KV.put("work:last", JSON.stringify({
        savedAt: new Date().toISOString(),
        data
      }));

      await env.WORK_R2.put(
        "backup/latest.json",
        JSON.stringify(data, null, 2),
        {
          httpMetadata: {
            contentType: "application/json; charset=utf-8"
          }
        }
      );

      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/load") {
      const saved = await env.WORK_KV.get("work:last", "json");
      return Response.json({ ok: true, saved });
    }

    if (url.pathname === "/api/backup") {
      const obj = await env.WORK_R2.get("backup/latest.json");
      if (!obj) return Response.json({ ok: false, error: "backup not found" }, { status: 404 });

      return new Response(obj.body, {
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        }
      });
    }

    return new Response("WORK Worker 실행됨", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }
};