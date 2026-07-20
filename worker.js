// worker.js
const DATA_KEY = "work_master_backup";
const FEED_KEY = "work_change_feed";
const MAX_FEED_EVENTS = 200;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, X-Original-Name",
  "Access-Control-Expose-Headers": "ETag, Content-Type, Content-Length, X-Original-Name, Content-Disposition",
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

function decodeOriginalName(value) {
  if (!value) return "";
  try { return decodeURIComponent(value); } catch { return String(value); }
}

function sanitizeOriginalName(value, fallbackExtension = "jpg") {
  let name = String(value || "").normalize("NFC")
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  if (!name) return `image.${fallbackExtension}`;
  if (!/\.[a-zA-Z0-9]{2,5}$/.test(name)) name += `.${fallbackExtension}`;
  return name.slice(0, 180);
}

function asciiFileName(name) {
  const extension = (String(name).match(/\.[a-zA-Z0-9]{2,5}$/) || [`.jpg`])[0];
  const base = String(name).slice(0, -extension.length).replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
  return `${base}${extension.toLowerCase()}`;
}

function createImageUrl(url, key) {
  return `${url.origin}/api/image?key=${encodeURIComponent(key)}`;
}

// ─── 빈 페이로드 (v2: groups 통합 구조) ───
function createEmptyPayload() {
  return {
    app: "work",
    version: 2,
    savedAt: "1970-01-01T00:00:00.000Z",
    syncUpdatedAt: "1970-01-01T00:00:00.000Z",
    data: {
      logs: [],
      trash: [],
      groups: [],    // v2 통합 그룹
      // v1 하위 호환 키 (읽기 전용, 저장은 groups로)
      taskTypes: [],
      coworkers: [],
      statuses: [],
      equipments: [],
      memoTags: [],
    },
  };
}

// ─── 정규화: v1 → v2 자동 업그레이드 ───
function normalizePayload(payload) {
  const result = payload && typeof payload === "object"
    ? payload
    : createEmptyPayload();

  if (!result.data || typeof result.data !== "object") {
    result.data = {};
  }

  // logs / trash 배열 보장
  for (const key of ["logs", "trash"]) {
    if (!Array.isArray(result.data[key])) {
      result.data[key] = [];
    }
  }

  // v1 하위 호환 키 보장
  for (const key of ["taskTypes", "coworkers", "statuses", "equipments", "memoTags"]) {
    if (!Array.isArray(result.data[key])) {
      result.data[key] = [];
    }
  }

  // v2 groups 보장
  if (!Array.isArray(result.data.groups)) {
    result.data.groups = [];
  }

  // v1 → v2 마이그레이션 (서버 측)
  if (result.data.groups.length === 0 && (
    result.data.taskTypes.length > 0 ||
    result.data.coworkers.length > 0 ||
    result.data.statuses.length > 0 ||
    result.data.equipments.length > 0 ||
    result.data.memoTags.length > 0
  )) {
    result.data.groups = migrateV1ToGroups(result.data);
  }

  result.version = 2;
  return result;
}

// ─── 서버 측 v1 → v2 마이그레이션 ───
function migrateV1ToGroups(data) {
  const DEFAULT_META = [
    { id: 'taskTypes', title: '작업유형', order: 0, selectionMode: 'multi' },
    { id: 'coworkers', title: '매니저', order: 1, selectionMode: 'multi' },
    { id: 'statuses', title: '상태', order: 2, selectionMode: 'single' },
    { id: 'equipments', title: '장비', order: 3, selectionMode: 'qty' },
    { id: 'memoTags', title: '메모태그', order: 4, selectionMode: 'tag' },
  ];

  return DEFAULT_META.map(meta => ({
    ...meta,
    enabled: true,
    tags: (data[meta.id] || []).filter(Boolean),
  }));
}

async function readStoredBackup(env) {
  const raw = await env.WORK_KV.get(DATA_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

async function readFeed(env) {
  const raw = await env.WORK_KV.get(FEED_KEY);
  if (!raw) return [];
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
    JSON.stringify({ savedAt, saved: normalized })
  );

  await appendFeed(env, { ...event, savedAt });
  return savedAt;
}

function upsertItem(items, incomingItem) {
  if (!incomingItem || incomingItem.id === undefined) return items;
  const id = String(incomingItem.id);
  const index = items.findIndex((item) => String(item.id) === id);
  if (index >= 0) items[index] = incomingItem;
  else items.push(incomingItem);
  return items;
}

function deleteItem(items, id) {
  return items.filter((item) => String(item.id) !== String(id));
}

function applyOperations(data, operations) {
  for (const operation of operations || []) {
    if (!operation) continue;
    const collection = operation.collection;
    if (collection !== "logs" && collection !== "trash") continue;

    if (operation.action === "delete") {
      data[collection] = deleteItem(data[collection], operation.id);
      continue;
    }
    if (operation.action === "upsert" && operation.item) {
      data[collection] = upsertItem(data[collection], operation.item);
    }
  }
}

// ─── v2: master = groups 배열 통합 ───
function applyMaster(data, master) {
  if (!master || typeof master !== "object") return;

  // v2: groups 통합 구조
  if (Array.isArray(master.groups)) {
    data.groups = master.groups;

    // v1 하위 호환 키도 동기화
    for (const g of master.groups) {
      if (["taskTypes","coworkers","statuses","equipments","memoTags"].includes(g.id)) {
        data[g.id] = g.tags || [];
      }
    }
    return;
  }

  // v1 하위 호환 (구 클라이언트에서 올라온 경우)
  for (const key of ["taskTypes","coworkers","statuses","equipments","memoTags"]) {
    if (Array.isArray(master[key])) {
      data[key] = master[key];
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/") {
      return new Response(
        "# WORK Worker 실행중\nKV + R2 + 부분 동기화 연결 완료 (v2)",
        { headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    // ─── 이미지 업로드 ───
    if (url.pathname === "/api/upload" && request.method === "POST") {
      try {
        if (!env.WORK_R2) return json({ ok: false, error: "WORK_R2 binding is missing" }, 500);
        const contentType = request.headers.get("Content-Type") || "application/octet-stream";
        if (!contentType.toLowerCase().startsWith("image/")) return json({ ok: false, error: "Only image upload is allowed" }, 400);
        if (!request.body) return json({ ok: false, error: "Image body is empty" }, 400);
        const extension = getImageExtension(contentType);
        const originalName = sanitizeOriginalName(
          decodeOriginalName(request.headers.get("X-Original-Name")),
          extension
        );
        const key = `images/${Date.now()}_${crypto.randomUUID()}.${extension}`;
        await env.WORK_R2.put(key, request.body, {
          httpMetadata: { contentType },
          customMetadata: { originalName }
        });
        return json({ ok: true, key, url: createImageUrl(url, key), originalName });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // ─── 이미지 조회 ───
    if (url.pathname === "/api/image" && request.method === "GET") {
      try {
        if (!env.WORK_R2) return json({ ok: false, error: "WORK_R2 binding is missing" }, 500);
        const key = url.searchParams.get("key");
        if (!key || !key.startsWith("images/")) return json({ ok: false, error: "Invalid image key" }, 400);
        const object = await env.WORK_R2.get(key);
        if (!object) return json({ ok: false, error: "Image not found" }, 404);
        const headers = new Headers(CORS_HEADERS);
        object.writeHttpMetadata(headers);
        const extension = getImageExtension(headers.get("Content-Type"));
        const originalName = sanitizeOriginalName(object.customMetadata?.originalName, extension);
        headers.set("X-Original-Name", encodeURIComponent(originalName));
        if (url.searchParams.get("download") === "1") {
          headers.set(
            "Content-Disposition",
            `attachment; filename="${asciiFileName(originalName)}"; filename*=UTF-8''${encodeURIComponent(originalName)}`
          );
        }
        headers.set("ETag", object.httpEtag);
        headers.set("Cache-Control", "private, max-age=3600");
        return new Response(object.body, { status: 200, headers });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    if (!env.WORK_KV) return json({ ok: false, error: "WORK_KV binding is missing" }, 500);

    // ─── 전체 저장 ───
    if (url.pathname === "/api/save" && request.method === "POST") {
      try {
        const body = await request.json();
        const savedAt = await savePayload(env, body, { type: "full" });
        return json({ ok: true, message: "saved", savedAt });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // ─── 전체 로드 ───
    if (url.pathname === "/api/load" && request.method === "GET") {
      try {
        const stored = await readStoredBackup(env);
        if (!stored) return json({ ok: true, empty: true, saved: null });
        return json({ ok: true, empty: false, ...stored });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // ─── 부분 저장 (patch) ───
    if (url.pathname === "/api/patch" && request.method === "POST") {
      try {
        const body = await request.json();
        const operations = Array.isArray(body.operations) ? body.operations : [];
        const stored = await readStoredBackup(env);
        const payload = normalizePayload(
          stored && stored.saved ? stored.saved : createEmptyPayload()
        );

        applyOperations(payload.data, operations);
        applyMaster(payload.data, body.master);

        const savedAt = await savePayload(env, payload, {
          type: "patch",
          operations,
          master: body.master || null,
        });

        return json({ ok: true, message: "patched", savedAt, changedCards: operations.length });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    // ─── 변경 확인 ───
    if (url.pathname === "/api/changes" && request.method === "GET") {
      try {
        const since = url.searchParams.get("since") || "1970-01-01T00:00:00.000Z";
        const stored = await readStoredBackup(env);

        if (!stored || !stored.saved) return json({ ok: true, changed: false });

        const savedAt = stored.savedAt || stored.saved.syncUpdatedAt || stored.saved.savedAt;

        if (!savedAt || savedAt <= since) return json({ ok: true, changed: false, savedAt });

        const feed = await readFeed(env);
        const relevantEvents = feed.filter(event => event && event.savedAt > since);

        const mustSendFullSnapshot =
          relevantEvents.length === 0 ||
          feed.length === 0 ||
          since < feed[0].savedAt ||
          relevantEvents.some(event => event.type === "full");

        if (mustSendFullSnapshot) {
          return json({
            ok: true, changed: true, full: true,
            data: normalizePayload(stored.saved).data,
            savedAt,
          });
        }

        const operations = [];
        let master = null;

        for (const event of relevantEvents) {
          if (Array.isArray(event.operations)) operations.push(...event.operations);
          if (event.master) master = event.master;
        }

        return json({ ok: true, changed: true, full: false, operations, master, savedAt });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    return json({ ok: false, error: "not found", path: url.pathname }, 404);
  },
};
