const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    if (url.pathname === "/") {
      return new Response("# WORK Worker 실행중\nKV + R2 연결 완료", {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    if (url.pathname === "/api/save" && request.method === "POST") {
      try {
        const body = await request.json();

        await env.WORK_KV.put(
          "work_master_backup",
          JSON.stringify({
            savedAt: new Date().toISOString(),
            saved: body,
          })
        );

        return json({
          ok: true,
          message: "saved",
          savedAt: new Date().toISOString(),
        });
      } catch (e) {
        return json({
          ok: false,
          error: e.message,
        }, 500);
      }
    }

    if (url.pathname === "/api/load" && request.method === "GET") {
      try {
        const raw = await env.WORK_KV.get("work_master_backup");

        if (!raw) {
          return json({
            ok: true,
            empty: true,
            saved: null,
          });
        }

        return json({
          ok: true,
          empty: false,
          ...JSON.parse(raw),
        });
      } catch (e) {
        return json({
          ok: false,
          error: e.message,
        }, 500);
      }
    }

    return json({
      ok: false,
      error: "not found",
      path: url.pathname,
    }, 404);
  },
};