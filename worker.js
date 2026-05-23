export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // CORS
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        // OPTIONS 처리
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        // =========================
        // 저장 API
        // =========================
        if (url.pathname === "/api/save") {
            try {
                const body = await request.json();

                const saveData = {
                    savedAt: new Date().toISOString(),
                    data: body.data || body
                };

                // KV 저장
                await env.WORK_KV.put(
                    "work:last",
                    JSON.stringify(saveData)
                );

                // R2 백업 저장
                await env.WORK_R2.put(
                    "backup/latest.json",
                    JSON.stringify(saveData, null, 2),
                    {
                        httpMetadata: {
                            contentType: "application/json"
                        }
                    }
                );

                return Response.json(
                    {
                        ok: true,
                        savedAt: saveData.savedAt
                    },
                    {
                        headers: corsHeaders
                    }
                );

            } catch (e) {
                return Response.json(
                    {
                        ok: false,
                        error: e.message
                    },
                    {
                        status: 500,
                        headers: corsHeaders
                    }
                );
            }
        }

        // =========================
        // 불러오기 API
        // =========================
        if (url.pathname === "/api/load") {
            try {
                const saved = await env.WORK_KV.get(
                    "work:last",
                    "json"
                );

                return Response.json(
                    {
                        ok: true,
                        saved
                    },
                    {
                        headers: corsHeaders
                    }
                );

            } catch (e) {
                return Response.json(
                    {
                        ok: false,
                        error: e.message
                    },
                    {
                        status: 500,
                        headers: corsHeaders
                    }
                );
            }
        }

        // =========================
        // 백업 다운로드 API
        // =========================
        if (url.pathname === "/api/backup") {
            try {
                const obj = await env.WORK_R2.get(
                    "backup/latest.json"
                );

                if (!obj) {
                    return Response.json(
                        {
                            ok: false,
                            error: "backup not found"
                        },
                        {
                            status: 404,
                            headers: corsHeaders
                        }
                    );
                }

                return new Response(obj.body, {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json; charset=utf-8"
                    }
                });

            } catch (e) {
                return Response.json(
                    {
                        ok: false,
                        error: e.message
                    },
                    {
                        status: 500,
                        headers: corsHeaders
                    }
                );
            }
        }

        // =========================
        // 기본 페이지
        // =========================
        return new Response(
            `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>WORK Worker</title>
<style>
body{
    background:#111;
    color:#0f0;
    font-family:monospace;
    padding:40px;
}
</style>
</head>
<body>
<h1>WORK Worker 실행중</h1>
<p>KV + R2 연결 완료</p>
</body>
</html>
            `,
            {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "text/html; charset=utf-8"
                }
            }
        );
    }
};