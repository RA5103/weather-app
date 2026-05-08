import { useState, useEffect, useCallback, useRef, memo } from "react";

// ── Weather code map ──────────────────────────────────────────────────────────
const WMO = {
  0:{l:"Clear",i:"☀️"},1:{l:"Mainly Clear",i:"🌤️"},2:{l:"Partly Cloudy",i:"⛅"},
  3:{l:"Overcast",i:"☁️"},45:{l:"Fog",i:"🌫️"},48:{l:"Icy Fog",i:"🌫️"},
  51:{l:"Light Drizzle",i:"🌦️"},53:{l:"Drizzle",i:"🌦️"},55:{l:"Heavy Drizzle",i:"🌧️"},
  61:{l:"Light Rain",i:"🌧️"},63:{l:"Rain",i:"🌧️"},65:{l:"Heavy Rain",i:"🌧️"},
  71:{l:"Light Snow",i:"🌨️"},73:{l:"Snow",i:"❄️"},75:{l:"Heavy Snow",i:"❄️"},
  77:{l:"Snow Grains",i:"🌨️"},80:{l:"Light Showers",i:"🌦️"},81:{l:"Showers",i:"🌧️"},
  82:{l:"Heavy Showers",i:"⛈️"},85:{l:"Snow Showers",i:"🌨️"},86:{l:"Heavy Snow Showers",i:"❄️"},
  95:{l:"Thunderstorm",i:"⛈️"},96:{l:"Thunderstorm+Hail",i:"⛈️"},99:{l:"Thunderstorm+Hail",i:"⛈️"},
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const uvLabel = i => i<=2?"Low":i<=5?"Moderate":i<=7?"High":i<=10?"Very High":"Extreme";
const dirLabel = d => ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(d/22.5)%16];
const fmtHour = iso => new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",hour12:true});
const fmtDay  = iso => new Date(iso).toLocaleDateString("en-US",{weekday:"short"});
const fmtTS   = ts  => ts ? new Date(ts*1000).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}) : "—";

// ── Liquid glass style tokens ─────────────────────────────────────────────────
const G = {
  sm: {
    background:"rgba(255,255,255,0.08)",
    backdropFilter:"blur(20px) saturate(160%)",
    WebkitBackdropFilter:"blur(20px) saturate(160%)",
    border:"1px solid rgba(255,255,255,0.15)",
    boxShadow:"0 4px 24px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.18),inset 0 -1px 0 rgba(0,0,0,0.08)",
  },
  md: {
    background:"rgba(255,255,255,0.10)",
    backdropFilter:"blur(32px) saturate(180%)",
    WebkitBackdropFilter:"blur(32px) saturate(180%)",
    border:"1px solid rgba(255,255,255,0.20)",
    boxShadow:"0 8px 32px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.22),inset 0 -1px 0 rgba(0,0,0,0.10)",
  },
  lg: {
    background:"rgba(255,255,255,0.13)",
    backdropFilter:"blur(48px) saturate(200%)",
    WebkitBackdropFilter:"blur(48px) saturate(200%)",
    border:"1px solid rgba(255,255,255,0.28)",
    boxShadow:"0 16px 48px rgba(0,0,0,0.3),inset 0 1.5px 0 rgba(255,255,255,0.3),inset 0 -1px 0 rgba(0,0,0,0.12)",
  },
};

// ── Reusable glass card ───────────────────────────────────────────────────────
const Card = memo(({ label, value, sub, wide }) => (
  <div style={{
    ...G.md, borderRadius:20, padding:"14px 16px",
    gridColumn: wide ? "span 2" : undefined,
    transition:"transform 0.15s",
  }}>
    <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>{label}</div>
    <div style={{fontSize:22,fontWeight:500}}>{value}</div>
    {sub && <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3}}>{sub}</div>}
  </div>
));

const Row = memo(({ label, value, last }) => (
  <div style={{
    display:"flex",justifyContent:"space-between",padding:"11px 16px",fontSize:13,
    borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.06)",
  }}>
    <span style={{color:"rgba(255,255,255,0.4)"}}>{label}</span>
    <span>{value}</span>
  </div>
));

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function WeatherApp() {
  const [wx,   setWx]   = useState(null);
  const [loc,  setLoc]  = useState(null);
  const [err,  setErr]  = useState(null);
  const [busy, setBusy] = useState(false);
  const [q,    setQ]    = useState("");
  const [sugs, setSugs] = useState([]);
  const [open, setOpen] = useState(false);
  const [tab,  setTab]  = useState("today");
  const [unit, setUnit] = useState("C");
  const [hi,   setHi]   = useState(-1);   // highlighted suggestion index
  const ref  = useRef(null);
  const dRef = useRef(null);

  const toC  = useCallback(v => unit==="C" ? v : v*9/5+32, [unit]);
  const deg  = useCallback(v => `${Math.round(toC(v))}°`, [toC]);

  // ── Fetch weather (parallel requests) ─────────────────────────────────────
  const load = useCallback(async (lat, lon, name) => {
    setBusy(true); setErr(null); setOpen(false); setSugs([]);
    try {
      const [meteo, owm] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,` +
          `surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,visibility,is_day,dew_point_2m,cloud_cover` +
          `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,` +
          `precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max` +
          `&timezone=auto&forecast_days=7`
        ).then(r=>r.json()),
        fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=cc2e5aca50b042f9ca80e3c9a8a5a7eb&units=metric`
        ).then(r=>r.json()).catch(()=>null),
      ]);
      setWx({meteo,owm,lat,lon}); setLoc(name); setQ("");
    } catch { setErr("Could not load weather. Check connection."); }
    finally  { setBusy(false); }
  }, []);

  // ── GPS locate ────────────────────────────────────────────────────────────
  const gps = useCallback(() => {
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async ({coords:{latitude:lat,longitude:lon}}) => {
        const g = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`).then(r=>r.json()).catch(()=>null);
        const name = g ? (g.address?.city||g.address?.town||g.address?.village||g.address?.county||"Your Location") : "Your Location";
        load(lat,lon,name);
      },
      () => { setErr("Location access denied."); setBusy(false); }
    );
  }, [load]);

  // ── Autocomplete (debounced 300ms) ────────────────────────────────────────
  useEffect(() => {
    if (q.length < 2) { setSugs([]); setOpen(false); return; }
    clearTimeout(dRef.current);
    dRef.current = setTimeout(async () => {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&featuretype=city`).then(r=>r.json()).catch(()=>[]);
      setSugs(r); setOpen(r.length>0); setHi(-1);
    }, 300);
    return () => clearTimeout(dRef.current);
  }, [q]);

  // ── Click outside to close ────────────────────────────────────────────────
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",fn);
    return () => document.removeEventListener("mousedown",fn);
  }, []);

  // ── Auto-locate on mount ──────────────────────────────────────────────────
  useEffect(() => { gps(); }, []);

  const pick = s => { const n=s.display_name.split(",")[0]; load(parseFloat(s.lat),parseFloat(s.lon),n); };

  // ── Derived data ──────────────────────────────────────────────────────────
  const cur    = wx?.meteo?.current;
  const daily  = wx?.meteo?.daily;
  const hourly = wx?.meteo?.hourly;
  const owm    = wx?.owm;
  const wmo    = WMO[cur?.weather_code] || {l:"Unknown",i:"🌡️"};
  const now    = Date.now();

  const hrs = hourly ? hourly.time.reduce((a,t,i)=>{
    if(new Date(t)>=now && a.length<24)
      a.push({t,temp:hourly.temperature_2m[i],pop:hourly.precipitation_probability[i],code:hourly.weather_code[i],wind:hourly.wind_speed_10m[i]});
    return a;
  },[]) : [];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#080818 0%,#0d1b3e 35%,#1a0a2e 65%,#080c1a 100%)",color:"#fff",fontFamily:"'DM Mono','Fira Mono',monospace",maxWidth:430,margin:"0 auto",padding:"0 0 80px",position:"relative",overflow:"hidden"}}>

      {/* ── Ambient orbs ── */}
      {[
        {top:-100,left:-80,w:320,c:"rgba(80,120,255,0.22)"},
        {top:180,right:-80,w:280,c:"rgba(40,180,255,0.14)"},
        {bottom:120,left:-50,w:220,c:"rgba(160,60,255,0.11)"},
      ].map((o,i)=>(
        <div key={i} style={{position:"fixed",top:o.top,bottom:o.bottom,left:o.left,right:o.right,width:o.w,height:o.w,background:`radial-gradient(circle,${o.c} 0%,transparent 70%)`,borderRadius:"50%",pointerEvents:"none",zIndex:0}}/>
      ))}

      <style>{`
        *{box-sizing:border-box}
        input::placeholder{color:rgba(255,255,255,0.28)}
        ::-webkit-scrollbar{display:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%,100%{opacity:.5}50%{opacity:1}}
        .sug:hover{background:rgba(255,255,255,0.12)!important}
        .tab:active,.btn:active{transform:scale(.96)}
      `}</style>

      {/* ── Search bar ── */}
      <div style={{padding:"18px 14px 0",position:"relative",zIndex:20}}>
        <div ref={ref} style={{position:"relative"}}>
          <div style={{display:"flex",gap:8}}>

            {/* Input */}
            <div style={{flex:1,position:"relative"}}>
              <input
                value={q}
                onChange={e=>setQ(e.target.value)}
                onFocus={()=>sugs.length>0&&setOpen(true)}
                onKeyDown={e=>{
                  if(e.key==="Enter"){if(hi>=0&&sugs[hi])pick(sugs[hi]);else if(sugs[0])pick(sugs[0]);}
                  if(e.key==="ArrowDown")setHi(h=>Math.min(h+1,sugs.length-1));
                  if(e.key==="ArrowUp")setHi(h=>Math.max(h-1,-1));
                  if(e.key==="Escape")setOpen(false);
                }}
                placeholder="Search city…"
                style={{
                  width:"100%",padding:"11px 14px",fontSize:14,color:"#fff",
                  outline:"none",fontFamily:"inherit",
                  borderRadius: open&&sugs.length ? "16px 16px 0 0" : 16,
                  ...G.lg, transition:"border-radius 0.15s",
                }}
              />

              {/* Dropdown */}
              {open && sugs.length>0 && (
                <div style={{
                  position:"absolute",top:"100%",left:0,right:0,zIndex:200,
                  background:"rgba(10,10,30,0.88)",
                  backdropFilter:"blur(40px)",WebkitBackdropFilter:"blur(40px)",
                  border:"1px solid rgba(255,255,255,0.15)",borderTop:"none",
                  borderRadius:"0 0 16px 16px",
                  boxShadow:"0 20px 50px rgba(0,0,0,0.5)",
                  animation:"fadeUp 0.15s ease",overflow:"hidden",
                }}>
                  {sugs.map((s,i)=>{
                    const parts=s.display_name.split(",");
                    const city=parts[0], sub=parts.slice(1,3).join(",").trim();
                    return(
                      <div key={s.place_id} className="sug"
                        onMouseDown={()=>pick(s)} onMouseEnter={()=>setHi(i)}
                        style={{
                          padding:"11px 14px",cursor:"pointer",
                          background:hi===i?"rgba(255,255,255,0.1)":"transparent",
                          borderBottom:i<sugs.length-1?"1px solid rgba(255,255,255,0.06)":"none",
                          display:"flex",alignItems:"center",gap:10,transition:"background 0.12s",
                        }}>
                        <span style={{fontSize:15,opacity:.6}}>📍</span>
                        <div>
                          <div style={{fontSize:14,fontWeight:500}}>{city}</div>
                          {sub&&<div style={{fontSize:11,color:"rgba(255,255,255,0.38)",marginTop:1}}>{sub}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* GPS */}
<button className="btn" onClick={gps} title="Use my location" style={{...G.lg,borderRadius:16,color:"#fff",padding:"11px 13px",cursor:"pointer",fontSize:16,border:G.lg.border,display:"flex",alignItems:"center",justifyContent:"center"}}>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <line x1="12" y1="2" x2="12" y2="6"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="6" y2="12"/>
    <line x1="18" y1="12" x2="22" y2="12"/>
  </svg>
</button>
            
            {/* Unit */}
            <button className="btn" onClick={()=>setUnit(u=>u==="C"?"F":"C")} style={{...G.sm,borderRadius:16,color:"#fff",padding:"11px 12px",cursor:"pointer",fontSize:13,fontWeight:600,border:G.sm.border,fontFamily:"inherit",minWidth:44}}>
              °{unit==="C"?"F":"C"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Loading spinner ── */}
      {busy && (
        <div style={{textAlign:"center",padding:"60px 0",zIndex:1,position:"relative"}}>
          <div style={{width:36,height:36,border:"3px solid rgba(255,255,255,0.1)",borderTop:"3px solid rgba(255,255,255,0.7)",borderRadius:"50%",margin:"0 auto",animation:"spin 0.8s linear infinite"}}/>
          <div style={{marginTop:14,color:"rgba(255,255,255,0.35)",fontSize:12,animation:"shimmer 1.5s infinite"}}>Loading weather…</div>
        </div>
      )}

      {/* ── Error ── */}
      {err && !busy && (
        <div style={{margin:"16px 14px 0",...G.sm,borderRadius:16,padding:"13px 16px",fontSize:13,color:"#fca5a5",border:"1px solid rgba(255,80,80,0.3)",background:"rgba(255,60,60,0.08)"}}>
          ⚠️ {err}
        </div>
      )}

      {/* ── Main content ── */}
      {wx && cur && !busy && (
        <div style={{animation:"fadeUp 0.35s ease",position:"relative",zIndex:1}}>

          {/* Hero */}
          <div style={{padding:"26px 14px 18px",textAlign:"center"}}>
            <div style={{fontSize:78,lineHeight:1,marginBottom:8,filter:"drop-shadow(0 0 32px rgba(140,180,255,0.45))",userSelect:"none"}}>{wmo.i}</div>
            <div style={{fontSize:84,fontWeight:300,letterSpacing:-5,lineHeight:1,marginBottom:4,textShadow:"0 0 60px rgba(140,200,255,0.25)"}}>{deg(cur.temperature_2m)}</div>
            <div style={{color:"rgba(255,255,255,0.45)",fontSize:13,marginBottom:5}}>Feels like {deg(cur.apparent_temperature)}</div>
            <div style={{fontSize:15,fontWeight:500,letterSpacing:2,textTransform:"uppercase"}}>{wmo.l}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:5}}>📍 {loc}</div>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",margin:"0 14px 14px",padding:4,borderRadius:18,...G.md}}>
            {["today","hourly","week","details"].map(t=>(
              <button key={t} className="tab" onClick={()=>setTab(t)} style={{
                flex:1,padding:"9px 0",border:"none",borderRadius:14,fontFamily:"inherit",cursor:"pointer",
                fontSize:12,letterSpacing:.5,transition:"all 0.18s",
                background:tab===t?"rgba(255,255,255,0.18)":"transparent",
                boxShadow:tab===t?"0 2px 14px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.22)":"none",
                color:tab===t?"#fff":"rgba(255,255,255,0.32)",
                fontWeight:tab===t?600:400,
              }}>{t[0].toUpperCase()+t.slice(1)}</button>
            ))}
          </div>

          {/* ── TODAY ── */}
          {tab==="today" && (
            <div style={{padding:"0 14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Card label="Humidity"   value={`${cur.relative_humidity_2m}%`} sub={`Dew pt ${deg(cur.dew_point_2m)}`}/>
              <Card label="Wind"       value={`${Math.round(cur.wind_speed_10m)} km/h`} sub={`${dirLabel(cur.wind_direction_10m)} · Gusts ${Math.round(cur.wind_gusts_10m)}`}/>
              <Card label="UV Index"   value={cur.uv_index} sub={uvLabel(cur.uv_index)}/>
              <Card label="Pressure"   value={`${Math.round(cur.surface_pressure)}`} sub="hPa"/>
              <Card label="Visibility" value={`${(cur.visibility/1000).toFixed(1)}`} sub="km"/>
              <Card label="Cloud Cover"value={`${cur.cloud_cover}%`} sub={`Rain: ${cur.precipitation}mm`}/>
              <Card label="Sunrise"    value={fmtTS(owm?.sys?.sunrise)}/>
              <Card label="Sunset"     value={fmtTS(owm?.sys?.sunset)}/>
              {daily && <Card label="Today High" value={deg(daily.temperature_2m_max[0])}/>}
              {daily && <Card label="Today Low"  value={deg(daily.temperature_2m_min[0])}/>}
            </div>
          )}

          {/* ── HOURLY ── */}
          {tab==="hourly" && (
            <div style={{padding:"0 14px"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Next 24 Hours</div>
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:12}}>
                {hrs.map((h,i)=>(
                  <div key={i} style={{...G.sm,borderRadius:16,padding:"12px 10px",minWidth:66,textAlign:"center",flexShrink:0}}>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.38)",marginBottom:5}}>{i===0?"Now":fmtHour(h.t)}</div>
                    <div style={{fontSize:22,marginBottom:4}}>{(WMO[h.code]||WMO[0]).i}</div>
                    <div style={{fontSize:15,fontWeight:500}}>{deg(h.temp)}</div>
                    {h.pop>0&&<div style={{fontSize:10,color:"#7dd3fc",marginTop:3}}>💧{h.pop}%</div>}
                  </div>
                ))}
              </div>
              <div style={{...G.md,borderRadius:18,overflow:"hidden"}}>
                {hrs.slice(0,12).map((h,i,a)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",fontSize:13,borderBottom:i<a.length-1?"1px solid rgba(255,255,255,0.06)":"none"}}>
                    <span style={{color:"rgba(255,255,255,0.38)",width:46}}>{i===0?"Now":fmtHour(h.t)}</span>
                    <span>{(WMO[h.code]||WMO[0]).i}</span>
                    <span style={{flex:1,fontWeight:500}}>{deg(h.temp)}</span>
                    <span style={{color:"#7dd3fc",width:38,textAlign:"right"}}>{h.pop>0?`💧${h.pop}%`:""}</span>
                    <span style={{color:"rgba(255,255,255,0.3)",width:50,textAlign:"right"}}>{Math.round(h.wind)}km/h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── WEEK ── */}
          {tab==="week" && daily && (
            <div style={{padding:"0 14px"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>7-Day Forecast</div>
              <div style={{...G.md,borderRadius:18,overflow:"hidden"}}>
                {daily.time.map((t,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"13px 16px",borderBottom:i<6?"1px solid rgba(255,255,255,0.06)":"none"}}>
                    <span style={{width:44,fontSize:12,color:i===0?"#fff":"rgba(255,255,255,0.45)",fontWeight:i===0?600:400}}>{i===0?"Today":fmtDay(t)}</span>
                    <span style={{fontSize:20}}>{(WMO[daily.weather_code[i]]||WMO[0]).i}</span>
                    <span style={{fontSize:11,color:"#7dd3fc",width:36}}>{daily.precipitation_probability_max[i]>0?`💧${daily.precipitation_probability_max[i]}%`:""}</span>
                    <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center"}}>
                      <span style={{fontSize:13,color:"rgba(255,255,255,0.32)"}}>{deg(daily.temperature_2m_min[i])}</span>
                      <span style={{color:"rgba(255,255,255,0.12)"}}>·</span>
                      <span style={{fontSize:15,fontWeight:600}}>{deg(daily.temperature_2m_max[i])}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DETAILS ── */}
          {tab==="details" && (
            <div style={{padding:"0 14px"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Current Conditions</div>
              <div style={{...G.md,borderRadius:18,overflow:"hidden",marginBottom:12}}>
                {[
                  ["Temperature", deg(cur.temperature_2m)],
                  ["Feels Like",  deg(cur.apparent_temperature)],
                  ["Dew Point",   deg(cur.dew_point_2m)],
                  ["Humidity",    `${cur.relative_humidity_2m}%`],
                  ["Cloud Cover", `${cur.cloud_cover}%`],
                  ["Visibility",  `${(cur.visibility/1000).toFixed(1)} km`],
                  ["Precipitation",`${cur.precipitation} mm`],
                  ["Pressure",    `${Math.round(cur.surface_pressure)} hPa`],
                  ["UV Index",    `${cur.uv_index} — ${uvLabel(cur.uv_index)}`],
                  ["Wind Speed",  `${Math.round(cur.wind_speed_10m)} km/h`],
                  ["Wind Gusts",  `${Math.round(cur.wind_gusts_10m)} km/h`],
                  ["Wind Dir",    `${dirLabel(cur.wind_direction_10m)} (${Math.round(cur.wind_direction_10m)}°)`],
                ].map(([l,v],i,a)=><Row key={l} label={l} value={v} last={i===a.length-1}/>)}
              </div>
              {owm && (
                <>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Sun</div>
                  <div style={{...G.md,borderRadius:18,overflow:"hidden",marginBottom:12}}>
                    {[["Sunrise",fmtTS(owm.sys?.sunrise)],["Sunset",fmtTS(owm.sys?.sunset)],["Timezone",owm.timezone]].map(([l,v],i,a)=><Row key={l} label={l} value={v} last={i===a.length-1}/>)}
                  </div>
                </>
              )}
              <div style={{...G.sm,borderRadius:14,padding:"12px 16px",fontSize:11,color:"rgba(255,255,255,0.25)"}}>
                Data: Open-Meteo + OpenWeatherMap · {wx.lat.toFixed(4)}, {wx.lon.toFixed(4)}
              </div>
            </div>
          )}
        </div>
      )}

      {!wx && !busy && !err && (
        <div style={{textAlign:"center",padding:60,color:"rgba(255,255,255,0.25)",fontSize:13}}>Allow location or search a city</div>
      )}
    </div>
  );
}
