const DATA_KEY = "work_master_backup";
const FEED_KEY = "work_change_feed";
const MAX_FEED_EVENTS = 200;

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

function getImageExtension(contentType) {
  const type = String(contentType || "").toLowerCase();

  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";

  return "bin";
}

function createImageUrl(url, key) {
  return `${url.origin}/api/image?key=${encodeURIComponent(key)}`;
}

function createEmptyPayload() {
  return {
    app: "work",
    savedAt: "1970-01-01T00:00:00.000Z",
    syncUpdatedAt: "1970-01-01T00:00:00.000Z",
    data: {
      logs: [],
      trash: [],
      taskTypes: [],
      coworkers: [],
      statuses: [],
      equipments: [],
      memoTags: [],
    },
  };
}

function normalizePayload(payload) {
  const result = payload && typeof payload === "object"
    ? payload
    : createEmptyPayload();

  if (!result.data || typeof result.data !== "object") {
    result.data = {};
  }

  for (const key of [
    "logs",
    "trash",
    "taskTypes",
    "coworkers",
    "statuses",
    "equipments",
    "memoTags",
  ]) {
    if (!Array.isArray(result.data[key])) {
      result.data[key] = [];
    }
  }

  return result;
}

async function readStoredBackup(env) {
  const raw = await env.WORK_KV.get(DATA_KEY);

  if (!raw) {
    return null;
  }

  return JSON.parse(raw);
}

async function readFeed(env) {
  const raw = await env.WORK_KV.get(FEED_KEY);

  if (!raw) {
    return [];
  }

  try {
    const feed = JSON.parse(raw);
    return Array.isArray(feed) ? feed : [];
  } catch {
    return [];
  }
}

async function appendFeed(env, event) {
  const feed = await readFeed(env);

  feed.push(event);

  if (feed.length > MAX_FEED_EVENTS) {
    feed.splice(0, feed.length - MAX_FEED_EVENTS);
  }

  await env.WORK_KV.put(FEED_KEY, JSON.stringify(feed));
}

async function savePayload(env, payload, event) {
  const savedAt = new Date().toISOString();
  const normalized = normalizePayload(payload);

  normalized.savedAt = savedAt;
  normalized.syncUpdatedAt = savedAt;

  await env.WORK_KV.put(
    DATA_KEY,
    JSON.stringify({
      savedAt,
      saved: normalized,
    })
  );

  await appendFeed(env, {
    ...event,
    savedAt,
  });

  return savedAt;
}

function upsertItem(items, incomingItem) {
  if (!incomingItem || incomingItem.id === undefined) {
    return items;
  }

  const id = String(incomingItem.id);
  const index = items.findIndex((item) => String(item.id) === id);

  if (index >= 0) {
    items[index] = incomingItem;
  } else {
    items.push(incomingItem);
  }

  return items;
}

function deleteItem(items, id) {
  return items.filter((item) => String(item.id) !== String(id));
}

function applyOperations(data, operations) {
  for (const operation of operations || []) {
    if (!operation) continue;

    const collection = operation.collection;

    if (collection !== "logs" && collection !== "trash") {
      continue;
    }

    if (operation.action === "delete") {
      data[collection] = deleteItem(data[collection], operation.id);
      continue;
    }

    if (operation.action === "upsert" && operation.item) {
      data[collection] = upsertItem(data[collection], operation.item);
    }
  }
}

function applyMaster(data, master) {
  if (!master || typeof master !== "object") {
    return;
  }

  for (const key of [
    "taskTypes",
    "coworkers",
    "statuses",
    "equipments",
    "memoTags",
  ]) {
    if (Array.isArray(master[key])) {
      data[key] = master[key];
    }
  }
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
      return new Response(
        "# WORK Worker 실행중\nKV + R2 + 부분 동기화 연결 완료",
        {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    if (url.pathname === "/api/upload" && request.method === "POST") {
      try {
        if (!env.WORK_R2) {
          return json({
            ok: false,
            error: "WORK_R2 binding is missing",
          }, 500);
        }

        const contentType =
          request.headers.get("Content-Type") ||
          "application/octet-stream";

        if (!contentType.toLowerCase().startsWith("image/")) {
          return json({
            ok: false,
            error: "Only image upload is allowed",
          }, 400);
        }

        if (!request.body) {
          return json({
            ok: false,
            error: "Image body is empty",
          }, 400);
        }

        const extension = getImageExtension(contentType);
        const key =
          `images/${Date.now()}_${crypto.randomUUID()}.${extension}`;

        await env.WORK_R2.put(key, request.body, {
          httpMetadata: {
            contentType,
          },
        });

        return json({
          ok: true,
          key,
          url: createImageUrl(url, key),
        });
      } catch (e) {
        return json({
          ok: false,
          error: e.message,
        }, 500);
      }
    }

    if (url.pathname === "/api/image" && request.method === "GET") {
      try {
        if (!env.WORK_R2) {
          return json({
            ok: false,
            error: "WORK_R2 binding is missing",
          }, 500);
        }

        const key = url.searchParams.get("key");

        if (!key || !key.startsWith("images/")) {
          return json({
            ok: false,
            error: "Invalid image key",
          }, 400);
        }

        const object = await env.WORK_R2.get(key);

        if (!object) {
          return json({
            ok: false,
            error: "Image not found",
          }, 404);
        }

        const headers = new Headers(CORS_HEADERS);

        object.writeHttpMetadata(headers);
        headers.set("ETag", object.httpEtag);
        headers.set("Cache-Control", "private, max-age=3600");

        return new Response(object.body, {
          status: 200,
          headers,
        });
      } catch (e) {
        return json({
          ok: false,
          error: e.message,
        }, 500);
      }
    }

    if (!env.WORK_KV) {
      return json({
        ok: false,
        error: "WORK_KV binding is missing",
      }, 500);
    }

    if (url.pathname === "/api/save" && request.method === "POST") {
      try {
        const body = await request.json();

        const savedAt = await savePayload(env, body, {
          type: "full",
        });

        return json({
          ok: true,
          message: "saved",
          savedAt,
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
        const stored = await readStoredBackup(env);

        if (!stored) {
          return json({
            ok: true,
            empty: true,
            saved: null,
          });
        }

        return json({
          ok: true,
          empty: false,
          ...stored,
        });
      } catch (e) {
        return json({
          ok: false,
          error: e.message,
        }, 500);
      }
    }

    if (url.pathname === "/api/patch" && request.method === "POST") {
      try {
        const body = await request.json();
        const operations = Array.isArray(body.operations)
          ? body.operations
          : [];

        const stored = await readStoredBackup(env);
        const payload = normalizePayload(
          stored && stored.saved
            ? stored.saved
            : createEmptyPayload()
        );

        applyOperations(payload.data, operations);
        applyMaster(payload.data, body.master);

        const savedAt = await savePayload(env, payload, {
          type: "patch",
          operations,
          master: body.master || null,
        });

        return json({
          ok: true,
          message: "patched",
          savedAt,
          changedCards: operations.length,
        });
      } catch (e) {
        return json({
          ok: false,
          error: e.message,
        }, 500);
      }
    }

    if (url.pathname === "/api/changes" && request.method === "GET") {
      try {
        const since =
          url.searchParams.get("since") ||
          "1970-01-01T00:00:00.000Z";

        const stored = await readStoredBackup(env);

        if (!stored || !stored.saved) {
          return json({
            ok: true,
            changed: false,
          });
        }

        const savedAt =
          stored.savedAt ||
          stored.saved.syncUpdatedAt ||
          stored.saved.savedAt;

        if (!savedAt || savedAt <= since) {
          return json({
            ok: true,
            changed: false,
            savedAt,
          });
        }

        const feed = await readFeed(env);
        const relevantEvents = feed.filter(
          (event) => event && event.savedAt > since
        );

        const mustSendFullSnapshot =
          relevantEvents.length === 0 ||
          feed.length === 0 ||
          since < feed[0].savedAt ||
          relevantEvents.some((event) => event.type === "full");

        if (mustSendFullSnapshot) {
          return json({
            ok: true,
            changed: true,
            full: true,
            data: normalizePayload(stored.saved).data,
            savedAt,
          });
        }

        const operations = [];
        let master = null;

        for (const event of relevantEvents) {
          if (Array.isArray(event.operations)) {
            operations.push(...event.operations);
          }

          if (event.master) {
            master = event.master;
          }
        }

        return json({
          ok: true,
          changed: true,
          full: false,
          operations,
          master,
          savedAt,
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