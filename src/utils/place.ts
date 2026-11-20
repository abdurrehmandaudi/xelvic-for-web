/**
 * Places: where this browser is, and what a pair of numbers is called.
 *
 * All of this client's dealings with a position live here, for the reason
 * `place_probe.dart` gives on the app side — a position is the kind of thing
 * that breaks in a place that does not look like a position, and the fix should
 * be one file. The Spark camera's place tool and the composer's Location row
 * both come through here, so "where am I" answers the same in both.
 *
 * **Two halves, and they are not equally trustworthy.** The first half is the
 * browser's own fix, which costs a permission and nothing else. The second is a
 * name for it, which is a read from somebody else's server — OpenStreetMap, and
 * BigDataCloud behind it. See [reversePlace] for why that is worth what it costs
 * and [myPlace] for how the browser's own doubt about the first half is carried
 * out to whoever reads it.
 */
import axios from "axios";

/** A place, as everything that draws one wants it: a name and a position. */
export interface PlaceChoice {
  label: string;
  detail?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * A read from somebody else's server — OpenStreetMap, BigDataCloud.
 *
 * These are not Xelvic roads, so they must not go through the app's client:
 * that one prefixes the API base and attaches the account's bearer token, and
 * neither belongs to a third party. A bare `axios` call sends no credentials at
 * all. Cancellation is translated back into the `AbortError` the callers here
 * already recognise, because axios reports a cancelled request under its own
 * name.
 */
export async function getJson<T>(
  url: string,
  options: { headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
  try {
    const response = await axios.get<T>(url, { ...options, timeout: 15_000 });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error)) throw new DOMException("Aborted", "AbortError");
    throw error;
  }
}

/** The shortest honest name in an address: the near part, then the city. */
function compactPlace(
  address: Record<string, string> | undefined,
  fallback: string,
) {
  if (!address) return fallback;
  const first =
    address.amenity ||
    address.hotel ||
    address.road ||
    address.neighbourhood ||
    address.suburb ||
    address.city ||
    address.town ||
    address.village;
  const second =
    address.city ||
    address.town ||
    address.village ||
    address.state ||
    address.country;
  return (
    [first, second]
      .filter((part, index, all) => part && all.indexOf(part) === index)
      .join(", ") || fallback
  );
}

/**
 * What a pair of numbers is called, asked of OpenStreetMap and then of
 * BigDataCloud.
 *
 * The second is not a nicety: a reverse lookup is a read from a server that owes
 * this app nothing and rate-limits by caller, and the fallback is what keeps a
 * dropped one from turning into "no place" in front of somebody who is standing
 * in a street with a perfectly good name. A pair that neither can name is drawn
 * as the pair — `19.0700, 72.8700` — which is a real answer and not an error,
 * because the map link it travels with works either way.
 */
export async function reversePlace(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<PlaceChoice> {
  const query = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
  });
  try {
    const row = await getJson<{
      display_name?: string;
      address?: Record<string, string>;
    }>(`https://nominatim.openstreetmap.org/reverse?${query}`, {
      headers: { Accept: "application/json" },
      signal,
    });
    const fallback =
      row.display_name?.split(",").slice(0, 2).join(", ") ||
      `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    return {
      label: compactPlace(row.address, fallback),
      detail: row.display_name,
      latitude,
      longitude,
    };
  } catch (cause) {
    if ((cause as { name?: string } | null)?.name === "AbortError") throw cause;
    const fallbackQuery = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: "en",
    });
    const row = await getJson<{
      locality?: string;
      city?: string;
      principalSubdivision?: string;
      countryName?: string;
    }>(`https://api.bigdatacloud.net/data/reverse-geocode-client?${fallbackQuery}`, {
      headers: { Accept: "application/json" },
      signal,
    });
    const label =
      [row.locality || row.city, row.principalSubdivision]
        .filter(Boolean)
        .join(", ") ||
      row.countryName ||
      `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    return {
      label,
      detail: [
        row.locality,
        row.city,
        row.principalSubdivision,
        row.countryName,
      ]
        .filter((part, index, all) => part && all.indexOf(part) === index)
        .join(", "),
      latitude,
      longitude,
    };
  }
}

/**
 * Look for a place by name, through OpenStreetMap's search.
 *
 * The other half of a place: the browser says where it thinks it is, and this is
 * where somebody says *no* — the hotel they are sitting in, the street the party
 * is on, the city they are actually in while a connection-placed fix insists on
 * another one. The owner asked for both halves in as many words on 2026-10-15:
 * *"location select karte time manually bhi search kar sake, jaise kisi hotel ka
 * naam"*.
 *
 * A list of nothing is a real answer and not an error: the callers draw "nothing
 * by that name", which is also what an empty answer draws — the two are not
 * worth telling apart in front of somebody who just wants to type the name of
 * their hotel.
 */
export async function searchPlaces(
  query: string,
  signal: AbortSignal,
): Promise<PlaceChoice[]> {
  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    limit: "6",
    addressdetails: "1",
  });
  const rows = await getJson<
    Array<{
      display_name: string;
      lat: string;
      lon: string;
      address?: Record<string, string>;
    }>
  >(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  return rows.map((row) => ({
    label: compactPlace(
      row.address,
      row.display_name.split(",").slice(0, 2).join(", "),
    ),
    detail: row.display_name,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
  }));
}

/** Where this browser is, and how much the fix is worth. */
export interface PlaceFix extends PlaceChoice {
  latitude: number;
  longitude: number;
  /**
   * The radius the browser is willing to promise, or null when it did not say.
   *
   * Carried out of here because it is the difference between an answer worth
   * trusting and one worth doubting. A machine placed by its *connection*
   * instead of by a satellite lands wherever that connection is registered,
   * which in India is routinely a different city from the one the person is
   * standing in, and the only thing that says so is this number: tens of metres
   * is a fix, kilometres is a guess wearing a city's name. Reported on the app
   * side 2026-10-15 — *"mumbai se lucknow aa jau, abhi bhi mumbai aa raha"* —
   * so the sheet draws "approximate" beside such an answer rather than hiding
   * the doubt, and a search box sits under it for the times the guess is simply
   * wrong.
   */
  accuracy: number | null;
}

/**
 * Why a position could not be had, in the only distinctions worth drawing.
 *
 * `denied` is the one a person can act on — it is their browser's own setting,
 * and it is the only one where saying "allow it" is useful advice. The rest are
 * "this browser would not, or could not", which are the same sentence to
 * somebody who just wanted to share where they are.
 */
export type PlaceRefusal =
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  /**
   * The page is not on https, so the browser will not answer at all — not a
   * permission anybody can grant, and the one refusal whose advice is about the
   * address rather than about the browser.
   */
  | "insecure";

export type MyPlace =
  | { ok: true; fix: PlaceFix }
  | { ok: false; why: PlaceRefusal };

/**
 * Ask this browser where it is, and give the answer a name.
 *
 * The permission is the browser's to ask and it asks it itself: `getCurrentPosition`
 * raises the prompt when the answer is unknown and answers from the grant
 * afterwards, which is the same shape the app's own `geolocator` call has on a
 * phone. Nothing here prompts twice or works around a refusal — a `denied` comes
 * straight back out so the sheet can say so in words rather than sitting on a
 * spinner.
 *
 * **A fresh-ish fix, and deliberately not a cached one from anywhere but the
 * browser.** `maximumAge` is a minute, which is the browser's own cache and is
 * what keeps a sheet from waking the radio twice in a minute; the app's own rule
 * is the same, and its reason is the one above [PlaceFix].
 *
 * The coordinates go to a geocoder for a name — see [reversePlace]. That is a
 * deliberate, existing choice in this client and not a new one: the Spark
 * camera's place tool has always named a position this way. A position that no
 * geocoder can name is still a position, so a failed lookup leaves the numbers
 * and the map link and returns `ok` rather than a refusal.
 */
export async function myPlace(signal?: AbortSignal): Promise<MyPlace> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, why: "unsupported" };
  }
  // A browser only answers a position to a secure page. `localhost` counts as
  // secure; a LAN address typed over plain http does not, and there the call is
  // refused before any permission is asked — which reads exactly like a refusal
  // of something the person never saw a prompt for.
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return { ok: false, why: "insecure" };
  }
  // Two asks rather than one. High accuracy wakes the radio and can sit for its
  // whole clock on a desktop with no GPS in it, where the network's own guess
  // would have answered in a second — and a place sent from a laptop is the
  // city, not the doorway. The second ask is only skipped when the first was
  // refused outright, because asking again cannot undo a refusal.
  let position: GeolocationPosition | null = null;
  let refusal: GeolocationPositionError | null = null;
  for (const attempt of [
    { accurate: true, clock: 8_000 },
    { accurate: false, clock: 12_000 },
  ]) {
    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: attempt.accurate,
          maximumAge: 60_000,
          timeout: attempt.clock,
        });
      });
      break;
    } catch (cause) {
      refusal = cause as GeolocationPositionError | null;
      if (refusal?.code === 1) break;
    }
  }
  if (!position) {
    const code = refusal?.code;
    return {
      ok: false,
      why: code === 1 ? "denied" : code === 3 ? "timeout" : "unavailable",
    };
  }

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const accuracy = Number.isFinite(position.coords.accuracy)
    ? position.coords.accuracy
    : null;

  try {
    const named = await reversePlace(latitude, longitude, signal);
    return { ok: true, fix: { ...named, latitude, longitude, accuracy } };
  } catch (cause) {
    if ((cause as { name?: string } | null)?.name === "AbortError") throw cause;
    // A pair the geocoder could not name is still a pair, and the map link
    // travels with it. See the doc above.
    return {
      ok: true,
      fix: {
        label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        latitude,
        longitude,
        accuracy,
      },
    };
  }
}
