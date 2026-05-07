import { useState, useEffect, useCallback, useRef } from "react";

const WMO = {
  0: { label: "Clear", icon: "☀️" },
  1: { label: "Mainly Clear", icon: "🌤️" },
  2: { label: "Partly Cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Icy Fog", icon: "🌫️" },
  51: { label: "Light Drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy Drizzle", icon: "🌧️" },
  61: { label: "Light Rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy Rain", icon: "🌧️" },
  71: { label: "Light Snow", icon: "🌨️" },
  73: { label: "Snow", icon: "❄️" },
  75: { label: "Heavy Snow", icon: "❄️" },
  77: { label: "Snow Grains", icon: "🌨️" },
  80: { label: "Light Showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌧️" },
  82: { label: "Heavy Showers", icon: "⛈️" },
  85: { label: "Snow Showers", icon: "🌨️" },
  86: { label: "Heavy Snow Showers", icon: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm + Hail", icon: "⛈️" },
  99: { label: "Thunderstorm + Hail", icon: "⛈️" },
};

const uvLabel = (i) => {
  if (i <= 2) return "Low";
  if (i <= 5) return "Moderate";
  if (i <= 7) return "High";
  if (i <= 10) return "Very High";
  return "Extreme";
};

const dirLabel = (deg) => {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
};

const fmt = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const fmtHour = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso * 1000);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

export default function WeatherApp() {
  const [weather, setWeather] = useState(null);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tab, setTab] = useState("today");
  const [unit, setUnit] = useState("C");
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch suggestions as user types
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&featuretype=city`
        ).then(r => r.json());
        setSuggestions(res);
        setShowSuggestions(res.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }, [query]);

  const fetchWeather = useCallback(async (lat, lon, name) => {
    setLoading(true);
    setError(null);
    setShowSuggestions(false);
    setSuggestions([]);
    try {
      const [meteo, owm] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,` +
          `surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,visibility,` +
          `is_day,dew_point_2m,cloud_cover` +
          `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,uv_index,relative_humidity_2m` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,` +
          `sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,` +
          `wind_gusts_10m_max,precipitation_hours` +
          `&timezone=auto&forecast_days=7`
        ).then(r => r.json()),
        fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=cc2e5aca50b042f9ca80e3c9a8a5a7eb&units=metric`
        ).then(r => r.json()).catch(() => null),
      ]);
      setWeather({ meteo, owm, lat, lon });
      setLocation(name);
    } catch (e) {
      setError("Failed to fetch weather data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const selectSuggestion = (place) => {
    const name = place.display_name.split(",")[0];
    setQuery("");
    setShowSuggestions(false);
    fetchWeather(parseFloat(place.lat), parseFloat(place.lon), name);
  };

  const geolocate = useCallback(() => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        ).then(r => r.json()).catch(() => null);
        const name = geo
          ? (geo.address?.city || geo.address?.town || geo.address?.village || geo.address?.county || "Your Location")
          : "Your Location";
        fetchWeather(lat, lon, name);
      },
      () => { setError("Location access denied."); setLoading(false); }
    );
  }, [fetchWeather]);

  useEffect(() => { geolocate(); }, []);

  const toUnit = (c) => unit === "C" ? c : (c * 9/5 + 32);
  const deg = (v) => `${Math.round(toUnit(v))}°`;

  const c = weather?.meteo?.current;
  const daily = weather?.meteo?.daily;
  const hourly = weather?.meteo?.hourly;
  const owm = weather?.owm;

  const now = new Date();
  const hourlySlice = hourly
    ? hourly.time.reduce((acc, t, i) => {
        if (new Date(t) >= now && acc.length < 24) {
          acc.push({ time: t, temp: hourly.temperature_2m[i], pop: hourly.precipitation_probability[i], code: hourly.weather_code[i], wind: hourly.wind_speed_10m[i], humidity: hourly.relative_humidity_2m[i] });
        }
        return acc;
      }, [])
    : [];

  const wmo = WMO[c?.weather_code] || { label: "Unknown", icon: "🌡️" };
  const isDay = c?.is_day !== 0;

  const styles = {
    app: {
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f0c29, #302b63, #24243e)",
      color: "#fff",
      fontFamily: "'DM Mono', 'Fira Mono', monospace",
      maxWidth: 430,
      margin: "0 auto",
      padding: "0 0 80px",
      position: "relative",
    },
    header: {
      padding: "20px 20px 0",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    searchRow: {
      display: "flex",
      gap: 8,
      position: "relative",
    },
    searchWrap: {
      flex: 1,
      position: "relative",
    },
    input: {
      width: "100%",
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: showSuggestions ? "10px 10px 0 0" : 10,
      padding: "10px 14px",
      color: "#fff",
      fontSize: 14,
      outline: "none",
      fontFamily: "inherit",
    },
    dropdown: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      background: "#1e1b4b",
      border: "1px solid rgba(255,255,255,0.15)",
      borderTop: "none",
      borderRadius: "0 0 10px 10px",
      zIndex: 100,
      overflow: "hidden",
    },
    suggestionItem: (hovered) => ({
      padding: "10px 14px",
      fontSize: 13,
      cursor: "pointer",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: hovered ? "rgba(255,255,255,0.1)" : "transparent",
      transition: "background 0.15s",
      display: "flex",
      flexDirection: "column",
      gap: 2,
    }),
    suggestionMain: {
      color: "#fff",
      fontWeight: "500",
    },
    suggestionSub: {
      color: "rgba(255,255,255,0.4)",
      fontSize: 11,
    },
    btn: {
      background: "rgba(255,255,255,0.12)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: 10,
      color: "#fff",
      padding: "10px 14px",
      cursor: "pointer",
      fontSize: 14,
      whiteSpace: "nowrap",
      fontFamily: "inherit",
    },
    unitToggle: {
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: 10,
      color: "#fff",
      padding: "10px 14px",
      cursor: "pointer",
      fontSize: 14,
      fontFamily: "inherit",
    },
    hero: {
      padding: "30px 20px 20px",
      textAlign: "center",
    },
    icon: {
      fontSize: 72,
      lineHeight: 1,
      marginBottom: 8,
      filter: "drop-shadow(0 4px 24px rgba(255,255,255,0.2))",
    },
    temp: {
      fontSize: 80,
      fontWeight: "300",
      letterSpacing: -4,
      margin: "0 0 4px",
      lineHeight: 1,
    },
    feels: {
      color: "rgba(255,255,255,0.55)",
      fontSize: 14,
      marginBottom: 6,
    },
    condition: {
      fontSize: 18,
      fontWeight: "500",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    locationName: {
      fontSize: 13,
      color: "rgba(255,255,255,0.5)",
      marginTop: 4,
    },
    tabs: {
      display: "flex",
      margin: "0 20px 16px",
      background: "rgba(255,255,255,0.06)",
      borderRadius: 12,
      padding: 3,
    },
    tabBtn: (active) => ({
      flex: 1,
      padding: "8px 0",
      border: "none",
      borderRadius: 9,
      background: active ? "rgba(255,255,255,0.18)" : "transparent",
      color: active ? "#fff" : "rgba(255,255,255,0.4)",
      cursor: "pointer",
      fontSize: 13,
      fontFamily: "inherit",
      fontWeight: active ? "600" : "400",
      transition: "all 0.2s",
    }),
    section: { padding: "0 20px" },
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 16,
    },
    card: {
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 14,
      padding: "14px 16px",
    },
    cardLabel: {
      fontSize: 11,
      color: "rgba(255,255,255,0.4)",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 6,
    },
    cardValue: { fontSize: 22, fontWeight: "500" },
    cardSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 },
    hourlyScroll: {
      display: "flex",
      gap: 10,
      overflowX: "auto",
      paddingBottom: 8,
      scrollbarWidth: "none",
      marginBottom: 16,
    },
    hourCard: {
      minWidth: 70,
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: "10px 8px",
      textAlign: "center",
      flexShrink: 0,
    },
    hourTime: { fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 6 },
    hourIcon: { fontSize: 20, marginBottom: 4 },
    hourTemp: { fontSize: 16, fontWeight: "500" },
    hourPop: { fontSize: 11, color: "#7dd3fc", marginTop: 3 },
    dayRow: {
      display: "flex",
      alignItems: "center",
      padding: "12px 0",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
      gap: 12,
    },
    dayName: { width: 40, fontSize: 13, color: "rgba(255,255,255,0.6)" },
    dayIcon: { fontSize: 22 },
    dayPop: { fontSize: 12, color: "#7dd3fc", width: 36 },
    dayTemps: { marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" },
    dayMax: { fontSize: 15, fontWeight: "600" },
    dayMin: { fontSize: 15, color: "rgba(255,255,255,0.4)" },
    sectionTitle: {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 1.5,
      color: "rgba(255,255,255,0.35)",
      marginBottom: 10,
      marginTop: 4,
    },
    fullCard: {
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 10,
    },
    row: {
      display: "flex",
      justifyContent: "space-between",
      padding: "6px 0",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      fontSize: 14,
    },
    rowLabel: { color: "rgba(255,255,255,0.5)" },
  };

  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <div style={styles.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      <div style={styles.header}>
        <div style={styles.searchRow}>
          <div style={styles.searchWrap} ref={wrapperRef}>
            <input
              style={styles.input}
              placeholder="Search city..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onKeyDown={e => {
                if (e.key === "Escape") setShowSuggestions(false);
              }}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div style={styles.dropdown}>
                {suggestions.map((place, i) => {
                  const parts = place.display_name.split(",");
                  const main = parts[0];
                  const sub = parts.slice(1, 3).join(",").trim();
                  return (
                    <div
                      key={place.place_id}
                      style={styles.suggestionItem(hoveredIdx === i)}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      onMouseDown={() => selectSuggestion(place)}
                      onTouchEnd={() => selectSuggestion(place)}
                    >
                      <span style={styles.suggestionMain}>📍 {main}</span>
                      <span style={styles.suggestionSub}>{sub}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button style={styles.btn} onClick={geolocate} title="Use my location">📍</button>
          <button style={styles.unitToggle} onClick={() => setUnit(u => u === "C" ? "F" : "C")}>
            °{unit === "C" ? "F" : "C"}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          Fetching weather…
        </div>
      )}

      {error && (
        <div style={{ margin: 20, padding: 16, background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)", borderRadius: 12, color: "#fca5a5", fontSize: 14 }}>
          {error}
        </div>
      )}

      {weather && c && (
        <>
          <div style={styles.hero}>
            <div style={styles.icon}>{wmo.icon}</div>
            <div style={styles.temp}>{deg(c.temperature_2m)}</div>
            <div style={styles.feels}>Feels like {deg(c.apparent_temperature)}</div>
            <div style={styles.condition}>{wmo.label}</div>
            <div style={styles.locationName}>📍 {location}</div>
          </div>

          <div style={styles.tabs}>
            {["today", "hourly", "week", "details"].map(t => (
              <button key={t} style={styles.tabBtn(tab === t)} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === "today" && (
            <div style={styles.section}>
              <div style={styles.grid}>
                <div style={styles.card}>
                  <div style={styles.cardLabel}>Humidity</div>
                  <div style={styles.cardValue}>{c.relative_humidity_2m}%</div>
                  <div style={styles.cardSub}>Dew pt {deg(c.dew_point_2m)}</div>
                </div>
                <div style={styles.card}>
                  <div style={styles.cardLabel}>Wind</div>
                  <div style={styles.cardValue}>{Math.round(c.wind_speed_10m)} km/h</div>
                  <div style={styles.cardSub}>{dirLabel(c.wind_direction_10m)} · Gusts {Math.round(c.wind_gusts_10m)}</div>
                </div>
                <div style={styles.card}>
                  <div style={styles.cardLabel}>UV Index</div>
                  <div style={styles.cardValue}>{c.uv_index}</div>
                  <div style={styles.cardSub}>{uvLabel(c.uv_index)}</div>
                </div>
                <div style={styles.card}>
                  <div style={styles.cardLabel}>Pressure</div>
                  <div style={styles.cardValue}>{Math.round(c.surface_pressure)}</div>
                  <div style={styles.cardSub}>hPa</div>
                </div>
                <div style={styles.card}>
                  <div style={styles.cardLabel}>Visibility</div>
                  <div style={styles.cardValue}>{(c.visibility / 1000).toFixed(1)}</div>
                  <div style={styles.cardSub}>km</div>
                </div>
                <div style={styles.card}>
                  <div style={styles.cardLabel}>Cloud Cover</div>
                  <div style={styles.cardValue}>{c.cloud_cover}%</div>
                  <div style={styles.cardSub}>Precip: {c.precipitation}mm</div>
                </div>
              </div>
              {daily && (
                <div style={styles.grid}>
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>Sunrise</div>
                    <div style={{fontSize:18, fontWeight:"500"}}>{fmtTime(owm?.sys?.sunrise)}</div>
                  </div>
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>Sunset</div>
                    <div style={{fontSize:18, fontWeight:"500"}}>{fmtTime(owm?.sys?.sunset)}</div>
                  </div>
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>Today High</div>
                    <div style={styles.cardValue}>{deg(daily.temperature_2m_max[0])}</div>
                  </div>
                  <div style={styles.card}>
                    <div style={styles.cardLabel}>Today Low</div>
                    <div style={styles.cardValue}>{deg(daily.temperature_2m_min[0])}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "hourly" && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Next 24 Hours</div>
              <div style={styles.hourlyScroll}>
                {hourlySlice.map((h, i) => (
                  <div key={i} style={styles.hourCard}>
                    <div style={styles.hourTime}>{i === 0 ? "Now" : fmtHour(h.time)}</div>
                    <div style={styles.hourIcon}>{(WMO[h.code] || WMO[0]).icon}</div>
                    <div style={styles.hourTemp}>{deg(h.temp)}</div>
                    {h.pop > 0 && <div style={styles.hourPop}>💧{h.pop}%</div>}
                  </div>
                ))}
              </div>
              <div style={styles.sectionTitle}>Hourly Details</div>
              <div style={styles.fullCard}>
                {hourlySlice.slice(0, 12).map((h, i) => (
                  <div key={i} style={{...styles.row, borderBottom: i === 11 ? "none" : styles.row.borderBottom}}>
                    <span style={styles.rowLabel}>{i === 0 ? "Now" : fmtHour(h.time)}</span>
                    <span>{(WMO[h.code] || WMO[0]).icon} {deg(h.temp)}</span>
                    <span style={{color:"#7dd3fc"}}>{h.pop > 0 ? `💧${h.pop}%` : ""}</span>
                    <span style={{color:"rgba(255,255,255,0.45)"}}>{Math.round(h.wind)}km/h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "week" && daily && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>7-Day Forecast</div>
              <div style={styles.fullCard}>
                {daily.time.map((t, i) => (
                  <div key={i} style={{...styles.dayRow, borderBottom: i === 6 ? "none" : styles.dayRow.borderBottom}}>
                    <div style={styles.dayName}>{i === 0 ? "Today" : fmt(t).split(",")[0]}</div>
                    <div style={styles.dayIcon}>{(WMO[daily.weather_code[i]] || WMO[0]).icon}</div>
                    <div style={styles.dayPop}>{daily.precipitation_probability_max[i] > 0 ? `💧${daily.precipitation_probability_max[i]}%` : ""}</div>
                    <div style={styles.dayTemps}>
                      <span style={styles.dayMin}>{deg(daily.temperature_2m_min[i])}</span>
                      <span style={{color:"rgba(255,255,255,0.2)"}}>·</span>
                      <span style={styles.dayMax}>{deg(daily.temperature_2m_max[i])}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "details" && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Current Conditions</div>
              <div style={styles.fullCard}>
                {[
                  ["Temperature", deg(c.temperature_2m)],
                  ["Feels Like", deg(c.apparent_temperature)],
                  ["Dew Point", deg(c.dew_point_2m)],
                  ["Humidity", `${c.relative_humidity_2m}%`],
                  ["Cloud Cover", `${c.cloud_cover}%`],
                  ["Visibility", `${(c.visibility/1000).toFixed(1)} km`],
                  ["Precipitation", `${c.precipitation} mm`],
                  ["Pressure", `${Math.round(c.surface_pressure)} hPa`],
                  ["UV Index", `${c.uv_index} — ${uvLabel(c.uv_index)}`],
                  ["Wind Speed", `${Math.round(c.wind_speed_10m)} km/h`],
                  ["Wind Gusts", `${Math.round(c.wind_gusts_10m)} km/h`],
                  ["Wind Direction", `${dirLabel(c.wind_direction_10m)} (${Math.round(c.wind_direction_10m)}°)`],
                ].map(([label, val], i, arr) => (
                  <div key={label} style={{...styles.row, borderBottom: i === arr.length-1 ? "none" : styles.row.borderBottom}}>
                    <span style={styles.rowLabel}>{label}</span>
                    <span>{val}</span>
                  </div>
                ))}
              </div>
              {owm && (
                <>
                  <div style={styles.sectionTitle}>Sun & Moon</div>
                  <div style={styles.fullCard}>
                    {[
                      ["Sunrise", fmtTime(owm.sys?.sunrise)],
                      ["Sunset", fmtTime(owm.sys?.sunset)],
                      ["Timezone", owm.timezone],
                    ].map(([label, val], i, arr) => (
                      <div key={label} style={{...styles.row, borderBottom: i === arr.length-1 ? "none" : styles.row.borderBottom}}>
                        <span style={styles.rowLabel}>{label}</span>
                        <span>{val}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={styles.sectionTitle}>Source</div>
              <div style={{...styles.fullCard, fontSize: 12, color: "rgba(255,255,255,0.4)"}}>
                Open-Meteo & OpenWeatherMap · {weather.lat.toFixed(4)}, {weather.lon.toFixed(4)}
              </div>
            </div>
          )}
        </>
      )}

      {!weather && !loading && !error && (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
          Allow location access or search for a city
        </div>
      )}
    </div>
  );
}
