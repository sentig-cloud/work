const ALLOWED_ACCESS_EMAILS = new Set(["sentig335@gmail.com"]);

function getAccessEmail(request) {
  return (
    request.headers.get("Cf-Access-Authenticated-User-Email") ||
    request.headers.get("cf-access-authenticated-user-email") ||
    ""
  )
    .trim()
    .toLowerCase();
}

function isAllowedAccessUser(request) {
  const email = getAccessEmail(request);
  return ALLOWED_ACCESS_EMAILS.has(email);
}

function accessDenied() {
  return json(
    {
      ok: false,
      error: "access denied",
    },
    403,
  );
}

function shouldProtectPath(pathname) {
  return pathname.startsWith("/api/");
}

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

    if (!env.WORK_KV) {
      return json({
        ok: false,
        error: "WORK_KV binding is missing",
      }, 500);
    }

    if (url.pathname === "/") {
      return new Response("# WORK Worker 실행중\nKV 연결 완료", {
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
