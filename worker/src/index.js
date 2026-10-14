const allowedOrigins = new Set([
  "https://pakin2013.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const songkhlaShelterCsvUrl =
  "https://songkhla.gdcatalog.go.th/dataset/59cca4fd-5bce-42f3-b007-42814a8f0604/resource/724184f4-7602-4335-b58f-2da50b2a3dc8/download/collective-centre.csv";
const songkhlaDatasetUrl =
  "https://data.go.th/dataset/59cca4fd-5bce-42f3-b007-42814a8f0604";

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
    sourceType: "google-maps",
    source: "Google Maps via SerpApi",
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(value);
      value = "";
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
    } else {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function distanceMeters(first, second) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = toRadians(second.lat - first.lat);
  const longitudeDifference = toRadians(second.lng - first.lng);
  const firstLatitude = toRadians(first.lat);
  const secondLatitude = toRadians(second.lat);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(haversine));
}

async function loadNearbyOfficialSongkhlaShelters(location) {
  const csvResponse = await fetch(songkhlaShelterCsvUrl, {
    cf: { cacheEverything: true, cacheTtl: 3600 },
    headers: { Accept: "text/csv" },
  });
  if (!csvResponse.ok) {
    throw new Error(`ข้อมูลศูนย์พักพิงจังหวัดสงขลาตอบกลับ ${csvResponse.status}`);
  }

  const rows = parseCsv((await csvResponse.text()).replace(/^\uFEFF/, ""));
  const headers = rows.shift()?.map((header) => header.trim());
  if (!headers) {
    throw new Error("ไฟล์ข้อมูลศูนย์พักพิงจังหวัดสงขลาไม่มีหัวตาราง");
  }
  const column = (name) => headers.indexOf(name);
  const columns = {
    year: column("ปี"),
    province: column("จังหวัด"),
    district: column("อำเภอ"),
    subdistrict: column("ตำบล"),
    village: column("หมู่บ้าน/ชุมชน(จำนวน)"),
    name: column("ชื่อศูนย์พักพิง"),
    capacity: column("จำนวนคนที่รองรับได้"),
    phone: column("หมายเลขโทรศัพท์"),
    lat: column("LAT"),
    lng: column("LONG"),
  };
  if (Object.values(columns).some((index) => index < 0)) {
    throw new Error("รูปแบบคอลัมน์ข้อมูลศูนย์พักพิงจังหวัดสงขลาเปลี่ยนไป");
  }

  return rows
    .map((cells, index) => {
      const lat = Number(cells[columns.lat]);
      const lng = Number(cells[columns.lng]);
      const name = (cells[columns.name] || "").trim();
      if (
        (cells[columns.province] || "").trim() !== "สงขลา" ||
        !name ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return null;
      }

      const locationDetails = [
        cells[columns.subdistrict],
        cells[columns.district],
        cells[columns.province],
      ]
        .map((part) => (part || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const shelter = {
        id: `songkhla-${cells[columns.year]}-${lat}-${lng}-${index}`,
        name,
        address: locationDetails.join(", "),
        type: "ศูนย์พักพิงชั่วคราว",
        lat,
        lng,
        mapUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        sourceType: "official-dataset",
        source: "สำนักงานป้องกันและบรรเทาสาธารณภัยจังหวัดสงขลา",
        sourceUrl: songkhlaDatasetUrl,
        dataYear: (cells[columns.year] || "").trim(),
        capacity: (cells[columns.capacity] || "").trim(),
        phone: (cells[columns.phone] || "").trim(),
        village: (cells[columns.village] || "").replace(/\s+/g, " ").trim(),
      };

      return {
        ...shelter,
        distance: distanceMeters(location, shelter),
      };
    })
    .filter((shelter) => shelter && shelter.distance <= 10000)
    .map(({ distance, ...shelter }) => shelter);
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

    let googleResults = (Array.isArray(providerData.local_results)
      ? providerData.local_results
      : [])
      .map(shelterFromResult)
      .filter(Boolean);
    let officialSongkhlaShelters = [];
    if (lat >= 6.2 && lat <= 7.9 && lng >= 99.5 && lng <= 101.5) {
      try {
        officialSongkhlaShelters = await loadNearbyOfficialSongkhlaShelters({ lat, lng });
      } catch (error) {
        return jsonResponse(
          {
            error:
              error instanceof Error
                ? `โหลดข้อมูลศูนย์พักพิงทางการไม่สำเร็จ: ${error.message}`
                : "โหลดข้อมูลศูนย์พักพิงทางการไม่สำเร็จ",
          },
          502,
          origin
        );
      }
      googleResults = googleResults.filter(
        (googleResult) =>
          !officialSongkhlaShelters.some(
            (officialShelter) =>
              googleResult.name.toLocaleLowerCase("th") ===
                officialShelter.name.toLocaleLowerCase("th") ||
              distanceMeters(googleResult, officialShelter) < 100
          )
      );
    }
    const shelters = [...officialSongkhlaShelters, ...googleResults];

    return jsonResponse(
      {
        shelters,
        sources: [
          "Google Maps via SerpApi",
          ...(officialSongkhlaShelters.length
            ? ["บัญชีศูนย์พักพิงชั่วคราวจังหวัดสงขลา ปี 2568"]
            : []),
        ],
        verified: false,
        notice: "ผลจาก Google Maps ไม่ใช่ทะเบียนทางการ ส่วนข้อมูลจังหวัดสงขลามาจากบัญชีศูนย์พักพิงปี 2568 และไม่ได้ยืนยันสถานะเปิดให้บริการในปัจจุบัน",
      },
      200,
      origin
    );
  },
};
