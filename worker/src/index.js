const allowedOrigins = new Set([
  "https://pakin2013.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function jsonResponse(body, status, origin) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function shelterFromResult(result, index) {
  const rawLat = result?.gps_coordinates?.latitude;
  const rawLng = result?.gps_coordinates?.longitude;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  const name = typeof result?.title === "string" ? result.title.trim() : "";
  if (
    !name ||
    rawLat === null ||
    rawLat === undefined ||
    (typeof rawLat === "string" && rawLat.trim() === "") ||
    rawLng === null ||
    rawLng === undefined ||
    (typeof rawLng === "string" && rawLng.trim() === "") ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  const candidateUrl = typeof result.link === "string" ? result.link : "";
  let mapUrl = "";
  try {
    const parsedUrl = new URL(candidateUrl);
    if (
      parsedUrl.protocol === "https:" &&
      ["www.google.com", "maps.google.com"].includes(parsedUrl.hostname) &&
      parsedUrl.pathname.startsWith("/maps")
    ) {
      mapUrl = parsedUrl.href;
    }
  } catch {
    mapUrl = "";
  }

  return {
    id: String(result.place_id || result.data_id || `${name}-${lat}-${lng}-${index}`),
    name,
    address: typeof result.address === "string" ? result.address : "",
    type: typeof result.type === "string" ? result.type : "",
    lat,
    lng,
    mapUrl,
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const headers = new Headers({
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
      });
      if (origin && allowedOrigins.has(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
      }
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "รองรับเฉพาะ GET" }, 405, origin);
    }
    if (url.pathname.replace(/\/+$/, "") !== "/api/shelters") {
      return jsonResponse({ error: "ไม่พบ endpoint นี้" }, 404, origin);
    }
    if (!origin || !allowedOrigins.has(origin)) {
      return jsonResponse({ error: "Origin นี้ไม่ได้รับอนุญาต" }, 403, origin);
    }

    const rawLat = url.searchParams.get("lat");
    const rawLng = url.searchParams.get("lng");
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (
      rawLat === null ||
      rawLat.trim() === "" ||
      rawLng === null ||
      rawLng.trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return jsonResponse({ error: "กรุณาระบุ lat และ lng ที่ถูกต้อง" }, 400, origin);
    }
    if (!env.SERPAPI_KEY) {
      return jsonResponse({ error: "Worker ยังไม่ได้ตั้งค่า SerpApi Secret" }, 500, origin);
    }

    const searchUrl = new URL("https://serpapi.com/search.json");
    searchUrl.searchParams.set("engine", "google_maps");
    searchUrl.searchParams.set("type", "search");
    searchUrl.searchParams.set("q", "ศูนย์พักพิง");
    searchUrl.searchParams.set("hl", "th");
    searchUrl.searchParams.set("gl", "th");
    searchUrl.searchParams.set(
      "ll",
      `@${lat.toFixed(3)},${lng.toFixed(3)},14z`
    );
    searchUrl.searchParams.set("api_key", env.SERPAPI_KEY);

    let providerResponse;
    try {
      providerResponse = await fetch(searchUrl, {
        headers: { Accept: "application/json" },
      });
    } catch {
      return jsonResponse({ error: "ติดต่อ SerpApi ไม่สำเร็จ" }, 502, origin);
    }
    if (!providerResponse.ok) {
      return jsonResponse(
        { error: `SerpApi ตอบกลับด้วยสถานะ ${providerResponse.status}` },
        502,
        origin
      );
    }

    let providerData;
    try {
      providerData = await providerResponse.json();
    } catch {
      return jsonResponse({ error: "SerpApi ส่งข้อมูลที่อ่านไม่ได้" }, 502, origin);
    }
    if (
      !providerData ||
      typeof providerData !== "object" ||
      providerData.error ||
      providerData.search_metadata?.status === "Error"
    ) {
      return jsonResponse({ error: "SerpApi ค้นหาไม่สำเร็จ กรุณาตรวจ Secret และโควตา" }, 502, origin);
    }

    const shelters = (Array.isArray(providerData.local_results)
      ? providerData.local_results
      : [])
      .map(shelterFromResult)
      .filter(Boolean);

    return jsonResponse(
      {
        shelters,
        source: "Google Maps via SerpApi",
        verified: false,
        notice: "แสดงผลทั้งหมดที่ Google Maps ส่งกลับมาในคำค้นนี้ แต่รายการอาจไม่ครบและไม่ได้ยืนยันว่าเป็นศูนย์พักพิงทางการหรือเปิดให้บริการ",
      },
      200,
      origin
    );
  },
};
