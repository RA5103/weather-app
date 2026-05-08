import { useState, useEffect, useCallback, useRef, memo } from "react";

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

const uvLabel  = i => i<=2?"Low":i<=5?"Moderate":i<=7?"High":i<=10?"Very High":"Extreme";
const dirLabel = d => ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(d/22.5)%16];
const fmtHour  = iso => new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",hour12:true});
const fmtDay   = iso => new Date(iso).toLocaleDateString("en-US",{weekday:"short"});
const fmtTS = (val) => {
  if (!val) return "—";
  // If it's a number (Unix TS from OWM), multiply by 1000. 
  // If it's a string (ISO from Meteo), use it directly.
  const date = typeof val === "number" ? new Date(val * 1000) : new Date(val);
  
  if (isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const G = {
  sm:{background:"rgba(255,255,255,0.08)",backdropFilter:"blur(20px) saturate(160%)",WebkitBackdropFilter:"blur(20px) saturate(160%)",border:"1px solid rgba(255,255,255,0.15)",boxShadow:"0 4px 24px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.18)"},
  md:{background:"rgba(255,255,255,0.10)",backdropFilter:"blur(32px) saturate(180%)",WebkitBackdropFilter:"blur(32px) saturate(180%)",border:"1px solid rgba(255,255,255,0.20)",boxShadow:"0 8px 32px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.22)"},
  lg:{background:"rgba(255,255,255,0.13)",backdropFilter:"blur(48px) saturate(200%)",WebkitBackdropFilter:"blur(48px) saturate(200%)",border:"1px solid rgba(255,255,255,0.28)",boxShadow:"0 16px 48px rgba(0,0,0,0.3),inset 0 1.5px 0 rgba(255,255,255,0.3)"},
};

const Card = memo(({label,value,sub})=>(
  <div style={{...G.md,borderRadius:20,padding:"14px 16px"}}>
    <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>{label}</div>
    <div style={{fontSize:22,fontWeight:500}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3}}>{sub}</div>}
  </div>
));

const Row = memo(({label,value,last})=>(
  <div style={{display:"flex",justifyContent:"space-between",padding:"11px 16px",fontSize:13,borderBottom:last?"none":"1px solid rgba(255,255,255,0.06)"}}>
    <span style={{color:"rgba(255,255,255,0.4)"}}>{label}</span><span>{value}</span>
  </div>
));

// ── Unit toggle pill ───────────────────────────────────────────────────────────
const UnitToggle = memo(({unit, onToggle})=>(
  <div onClick={onToggle} style={{
    width:72,height:44,borderRadius:16,cursor:"pointer",position:"relative",flexShrink:0,
    ...G.sm,
    display:"flex",alignItems:"center",padding:"4px",userSelect:"none",
  }}>
    {/* Sliding pill */}
    <div style={{
      position:"absolute",top:4,left:4,
      width:30,height:36,borderRadius:12,
      background:"rgba(255,255,255,0.22)",
      boxShadow:"0 2px 10px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.3)",
      transform: unit==="F" ? "translateX(34px)" : "translateX(0)",
      transition:"transform 0.22s cubic-bezier(.4,0,.2,1)",
    }}/>
    <span style={{flex:1,textAlign:"center",fontSize:11,fontWeight:600,color:unit==="C"?"#fff":"rgba(255,255,255,0.35)",zIndex:1,transition:"color 0.2s"}}>C</span>
    <span style={{flex:1,textAlign:"center",fontSize:11,fontWeight:600,color:unit==="F"?"#fff":"rgba(255,255,255,0.35)",zIndex:1,transition:"color 0.2s"}}>F</span>
  </div>
));

// ── Fetch preview for saved locations ─────────────────────────────────────────
async function fetchPreview(lat,lon){
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,apparent_temperature&timezone=auto`
  ).then(r=>r.json());
  return r.current;
}

export default function WeatherApp(){
  const [wx,      setWx]      = useState(null);
  const [loc,     setLoc]     = useState(null);
  const [err,     setErr]     = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [q,       setQ]       = useState("");
  const [sugs,    setSugs]    = useState([]);
  const [open,    setOpen]    = useState(false);
  const [tab,     setTab]     = useState("today");
  const [unit,    setUnit]    = useState("C");
  const [hi,      setHi]      = useState(-1);
  const [menuOpen,setMenuOpen]= useState(false);
  const [saved,   setSaved]   = useState(()=>{try{return JSON.parse(localStorage.getItem("wx_saved")||"[]")}catch{return []}});
  const [previews,setPreviews]= useState({});

  const ref    = useRef(null);
  const dRef   = useRef(null);
  const menuRef= useRef(null);

  const toC = useCallback(v=>unit==="C"?v:v*9/5+32,[unit]);
  const deg = useCallback(v=>`${Math.round(toC(v))}°`,[toC]);

  useEffect(()=>{ localStorage.setItem("wx_saved",JSON.stringify(saved)); },[saved]);

  // Refresh previews when saved list changes
  useEffect(()=>{
    saved.forEach(async s=>{
      try{
        const p = await fetchPreview(s.lat,s.lon);
        setPreviews(prev=>({...prev,[s.name]:p}));
      }catch{}
    });
  },[saved]);

  // ── Load full weather ────────────────────────────────────────────────────────
  const load = useCallback(async(lat,lon,name)=>{
    setBusy(true); setErr(null); setOpen(false); setSugs([]); setMenuOpen(false);
    try{
      const [meteo,owm] = await Promise.all([
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
    }catch{ setErr("Could not load weather. Check connection."); }
    finally{ setBusy(false); }
  },[]);

  // ── GPS — use browser Geolocation + Open-Meteo reverse geocode ──────────────
  const gps = useCallback(()=>{
    if(!navigator.geolocation){ setErr("Geolocation not supported."); return; }
    setBusy(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      async pos=>{
        const {latitude:lat,longitude:lon} = pos.coords;
        // Use Open-Meteo geocoding reverse (no CORS issues)
        try{
          // Try bigdatacloud for reverse geocoding - no API key, no CORS
          const gc = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          ).then(r=>r.json());
          const name = gc.city || gc.locality || gc.principalSubdivision || "My Location";
          load(lat,lon,name);
        }catch{
          load(lat,lon,"My Location");
        }
      },
      err=>{
        setBusy(false);
        if(err.code===1) setErr("Location denied. Please allow location access.");
        else if(err.code===2) setErr("Location unavailable. Try searching instead.");
        else setErr("Location timed out. Try searching instead.");
      },
      {enableHighAccuracy:true, timeout:10000, maximumAge:60000}
    );
  },[load]);

  // ── Autocomplete — use Open-Meteo geocoding API (no CORS, no key) ────────────
  useEffect(()=>{
    if(q.length<2){ setSugs([]); setOpen(false); return; }
    clearTimeout(dRef.current);
    dRef.current = setTimeout(async()=>{
      try{
        // Open-Meteo geocoding: free, CORS-enabled, no key needed
        const r = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`
        ).then(r=>r.json());
        const results = r.results || [];
        setSugs(results); setOpen(results.length>0); setHi(-1);
      }catch{ setSugs([]); setOpen(false); }
    },300);
    return ()=>clearTimeout(dRef.current);
  },[q]);

  // Close on outside click
  useEffect(()=>{
    const fn = e=>{
      if(ref.current&&!ref.current.contains(e.target)) setOpen(false);
      if(menuRef.current&&!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown",fn);
    return ()=>document.removeEventListener("mousedown",fn);
  },[]);

  useEffect(()=>{ gps(); },[]);

  // Pick from Open-Meteo geocoding result
  const pick = s=>{ load(s.latitude, s.longitude, s.name); };

  const saveLocation = ()=>{
    if(!wx||!loc||saved.find(s=>s.name===loc)) return;
    setSaved(prev=>[...prev,{name:loc,lat:wx.lat,lon:wx.lon}]);
    fetchPreview(wx.lat,wx.lon).then(p=>setPreviews(prev=>({...prev,[loc]:p}))).catch(()=>{});
  };

  const removeLocation = (name,e)=>{
    e.stopPropagation();
    setSaved(prev=>prev.filter(s=>s.name!==name));
    setPreviews(prev=>{ const n={...prev}; delete n[name]; return n; });
  };

  const isSaved = saved.find(s=>s.name===loc);
  const cur   = wx?.meteo?.current;
  const daily = wx?.meteo?.daily;
  const hourly= wx?.meteo?.hourly;
  const owm   = wx?.owm;
  const wmo   = WMO[cur?.weather_code]||{l:"Unknown",i:"🌡️"};
  const now   = Date.now();

  const hrs = hourly ? hourly.time.reduce((a,t,i)=>{
    if(new Date(t)>=now&&a.length<24)
      a.push({t,temp:hourly.temperature_2m[i],pop:hourly.precipitation_probability[i],code:hourly.weather_code[i],wind:hourly.wind_speed_10m[i]});
    return a;
  },[]) : [];

  return(
 <div style={{
  minHeight:"100vh",
  background:"linear-gradient(135deg,#080818 0%,#0d1b3e 35%,#1a0a2e 65%,#080c1a 100%)",
  color:"#fff",
  maxWidth:430,
  margin:"0 auto",
  padding:"0 0 80px",
  position:"relative",
  overflow:"hidden",
  fontFamily:"Arial, sans-serif"
}}>

      {[{top:-100,left:-80,w:320,c:"rgba(80,120,255,0.22)"},{top:180,right:-80,w:280,c:"rgba(40,180,255,0.14)"},{bottom:120,left:-50,w:220,c:"rgba(160,60,255,0.11)"}].map((o,i)=>(
        <div key={i} style={{position:"fixed",top:o.top,bottom:o.bottom,left:o.left,right:o.right,width:o.w,height:o.w,background:`radial-gradient(circle,${o.c} 0%,transparent 70%)`,borderRadius:"50%",pointerEvents:"none",zIndex:0}}/>
      ))}

    
     <style>{`
  **{
  box-sizing:border-box;
  font-family: Arial, sans-serif !important;
}

  input::placeholder{color:rgba(255,255,255,0.28)}
  ::-webkit-scrollbar{display:none}

  @keyframes fadeUp{
    from{opacity:0;transform:translateY(10px)}
    to{opacity:1;transform:translateY(0)}
  }

  @keyframes slideIn{
    from{opacity:0;transform:translateX(-12px)}
    to{opacity:1;transform:translateX(0)}
  }

  @keyframes spin{
    to{transform:rotate(360deg)}
  }

  @keyframes shimmer{
    0%,100%{opacity:.5}
    50%{opacity:1}
  }

  .sug:hover{
    background:rgba(255,255,255,0.1)!important
  }

  .tab:active,
  .icobtn:active{
    transform:scale(.94)
  }

  .locrow:hover{
    background:rgba(255,255,255,0.06)!important
  }
`}html, body, #root {
  font-family: Arial, sans-serif !important;
}</style>

      {/* ── Top bar ── */}
      <div style={{padding:"18px 14px 0",position:"relative",zIndex:20,display:"flex",gap:8,alignItems:"flex-start"}}>

        {/* Hamburger */}
        <div ref={menuRef} style={{position:"relative",flexShrink:0}}>
          <button className="icobtn" onClick={()=>setMenuOpen(m=>!m)}
            style={{...G.lg,borderRadius:16,color:"#fff",width:44,height:44,cursor:"pointer",border:G.lg.border,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,padding:0,transition:"all 0.15s"}}>
            <span style={{display:"block",width:16,height:1.5,background:"#fff",borderRadius:2,transition:"all 0.22s",transform:menuOpen?"rotate(45deg) translate(2px,3.5px)":"none",opacity:menuOpen?.6:1}}/>
            <span style={{display:"block",width:16,height:1.5,background:"#fff",borderRadius:2,transition:"all 0.22s",opacity:menuOpen?0:1,transform:menuOpen?"scaleX(0)":"scaleX(1)"}}/>
            <span style={{display:"block",width:16,height:1.5,background:"#fff",borderRadius:2,transition:"all 0.22s",transform:menuOpen?"rotate(-45deg) translate(2px,-3.5px)":"none",opacity:menuOpen?.6:1}}/>
          </button>

          {menuOpen&&(
            <div style={{position:"absolute",top:52,left:0,width:265,zIndex:300,...G.lg,borderRadius:20,overflow:"hidden",animation:"slideIn 0.18s ease",boxShadow:"0 24px 60px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.22)"}}>
              <div style={{padding:"14px 16px 10px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.38)",textTransform:"uppercase",letterSpacing:1.5}}>Saved Locations</div>
              </div>

              {saved.length===0?(
                <div style={{padding:"22px 16px",fontSize:12,color:"rgba(255,255,255,0.25)",textAlign:"center",lineHeight:1.7}}>
                  No saved locations.<br/>
                  <span style={{color:"rgba(255,255,255,0.38)"}}>Tap + below to save.</span>
                </div>
              ):(
                <div style={{maxHeight:320,overflowY:"auto"}}>
                  {saved.map((s,i)=>{
                    const p=previews[s.name];
                    const w=p?(WMO[p.weather_code]||WMO[0]):null;
                    const isActive=loc===s.name;
                    return(
                      <div key={s.name} className="locrow" onClick={()=>load(s.lat,s.lon,s.name)}
                        style={{padding:"12px 16px",cursor:"pointer",background:isActive?"rgba(255,255,255,0.07)":"transparent",borderBottom:i<saved.length-1?"1px solid rgba(255,255,255,0.06)":"none",display:"flex",alignItems:"center",gap:10,transition:"background 0.15s",borderLeft:isActive?"2px solid rgba(255,255,255,0.35)":"2px solid transparent"}}>
                        <div style={{fontSize:22,flexShrink:0}}>{w?w.i:"·"}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:isActive?"#fff":"rgba(255,255,255,0.82)"}}>{s.name}</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.32)",marginTop:2}}>{p?`${w.l} · ${Math.round(unit==="C"?p.apparent_temperature:p.apparent_temperature*9/5+32)}° feels`:"Loading…"}</div>
                        </div>
                        <div style={{fontSize:18,fontWeight:300,color:"rgba(255,255,255,0.88)",flexShrink:0}}>{p?`${Math.round(unit==="C"?p.temperature_2m:p.temperature_2m*9/5+32)}°`:""}</div>
                        <button onClick={e=>removeLocation(s.name,e)}
                          style={{background:"none",border:"none",color:"rgba(255,255,255,0.18)",cursor:"pointer",fontSize:18,padding:"0 0 0 4px",lineHeight:1,flexShrink:0}}
                          onMouseEnter={e=>e.currentTarget.style.color="rgba(255,90,90,0.7)"}
                          onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.18)"}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {loc&&(
                <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                  <button onClick={saveLocation} disabled={!!isSaved}
                    style={{width:"100%",padding:"10px",borderRadius:12,border:"none",cursor:isSaved?"default":"pointer",background:isSaved?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.1)",color:isSaved?"rgba(255,255,255,0.22)":"#fff",fontSize:12,fontFamily:"inherit",fontWeight:500,transition:"all 0.15s",letterSpacing:.4}}>
                    {isSaved?`✓ ${loc} saved`:`+ Save ${loc}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div ref={ref} style={{flex:1,position:"relative"}}>
          <div style={{display:"flex",gap:8}}>
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
                style={{width:"100%",padding:"11px 14px",fontSize:14,color:"#fff",outline:"none",fontFamily:"inherit",borderRadius:open&&sugs.length?"16px 16px 0 0":16,...G.lg,transition:"border-radius 0.15s"}}
              />

              {open&&sugs.length>0&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:"rgba(8,8,24,0.92)",backdropFilter:"blur(40px)",WebkitBackdropFilter:"blur(40px)",border:"1px solid rgba(255,255,255,0.14)",borderTop:"none",borderRadius:"0 0 16px 16px",boxShadow:"0 20px 50px rgba(0,0,0,0.5)",animation:"fadeUp 0.14s ease",overflow:"hidden"}}>
                  {sugs.map((s,i)=>(
                    <div key={s.id||i} className="sug" onMouseDown={()=>pick(s)} onMouseEnter={()=>setHi(i)}
                      style={{padding:"11px 14px",cursor:"pointer",background:hi===i?"rgba(255,255,255,0.09)":"transparent",borderBottom:i<sugs.length-1?"1px solid rgba(255,255,255,0.06)":"none",display:"flex",alignItems:"center",gap:10,transition:"background 0.1s"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:500}}>{s.name}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1}}>{[s.admin1,s.country].filter(Boolean).join(", ")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GPS */}
            <button className="icobtn" onClick={gps} title="Use my location"
              style={{...G.lg,borderRadius:16,color:"#fff",width:44,height:44,cursor:"pointer",border:G.lg.border,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
              </svg>
            </button>

            {/* Unit toggle pill */}
            <UnitToggle unit={unit} onToggle={()=>setUnit(u=>u==="C"?"F":"C")}/>
          </div>
        </div>
      </div>

      {/* Loading */}
      {busy&&(
        <div style={{textAlign:"center",padding:"64px 0",position:"relative",zIndex:1}}>
          <div style={{width:34,height:34,border:"2.5px solid rgba(255,255,255,0.08)",borderTop:"2.5px solid rgba(255,255,255,0.7)",borderRadius:"50%",margin:"0 auto",animation:"spin 0.75s linear infinite"}}/>
          <div style={{marginTop:14,color:"rgba(255,255,255,0.3)",fontSize:12,animation:"shimmer 1.5s infinite"}}>Loading weather…</div>
        </div>
      )}

      {err&&!busy&&(
        <div style={{margin:"16px 14px 0",...G.sm,borderRadius:16,padding:"13px 16px",fontSize:13,color:"#fca5a5",border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,50,50,0.07)"}}>
          ⚠️ {err}
        </div>
      )}

      {wx&&cur&&!busy&&(
        <div style={{animation:"fadeUp 0.3s ease",position:"relative",zIndex:1}}>

          {/* Hero */}
          <div style={{padding:"26px 14px 18px",textAlign:"center"}}>
            <div style={{fontSize:78,lineHeight:1,marginBottom:8,filter:"drop-shadow(0 0 32px rgba(140,180,255,0.4))",userSelect:"none"}}>{wmo.i}</div>
            <div style={{fontSize:84,fontWeight:300,letterSpacing:-5,lineHeight:1,marginBottom:4,textShadow:"0 0 60px rgba(140,200,255,0.2)"}}>{deg(cur.temperature_2m)}</div>
            <div style={{color:"rgba(255,255,255,0.42)",fontSize:13,marginBottom:5}}>Feels like {deg(cur.apparent_temperature)}</div>
            <div style={{fontSize:15,fontWeight:500,letterSpacing:2,textTransform:"uppercase"}}>{wmo.l}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.32)",marginTop:5}}>· {loc}</div>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",margin:"0 14px 14px",padding:4,borderRadius:18,...G.md}}>
            {["today","hourly","week","details"].map(t=>(
              <button key={t} className="tab" onClick={()=>setTab(t)}
                style={{flex:1,padding:"9px 0",border:"none",borderRadius:14,fontFamily:"inherit",cursor:"pointer",fontSize:12,letterSpacing:.4,transition:"all 0.18s",background:tab===t?"rgba(255,255,255,0.18)":"transparent",boxShadow:tab===t?"0 2px 14px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.2)":"none",color:tab===t?"#fff":"rgba(255,255,255,0.3)",fontWeight:tab===t?600:400}}>
                {t[0].toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>

          {tab==="today"&&(
      label="Wind"        
      value={`${Math.round(cur.wind_speed_10m)} km/h`}
      sub={`${dirLabel(cur.wind_direction_10m)} · Gusts ${Math.round(cur.wind_gusts_10m)}`}
    />

    <Card
      label="UV Index"    
      value={cur.uv_index}
      sub={uvLabel(cur.uv_index)}
    />

    <Card
      label="Pressure"    
      value={`${Math.round(cur.surface_pressure)}`}    
      sub="hPa"
    />

    <Card
      label="Visibility"  
      value={`${(cur.visibility/1000).toFixed(1)}`}    
      sub="km"
    />

    <Card
      label="Cloud Cover"
      value={`${cur.cloud_cover}%`}                    
      sub={`Rain: ${cur.precipitation}mm`}
    />

    <Card
      label="Sunrise"
      value={fmtTS(daily?.sunrise?.[0])}
    />

    <Card
      label="Sunset"  
      value={fmtTS(daily?.sunset?.[0])}
    />

    {daily&&(
      <Card
        label="Today High"
        value={deg(daily.temperature_2m_max[0])}
      />
    )}

    {daily&&(
      <Card
        label="Today Low"  
        value={deg(daily.temperature_2m_min[0])}
      />
    )}
  </div>
)}
         {tab==="hourly"&&(
    }}>
      Next 24 Hours
    </div>

    <div style={{...G.md,borderRadius:18,overflow:"hidden"}}>
      {hrs.slice(0,24).map((h,i,a)=>(
        <div
          key={i}
          style={{
            display:"flex",
            alignItems:"center",
            gap:10,
            padding:"12px 16px",
            fontSize:13,
            borderBottom:i<a.length-1?"1px solid rgba(255,255,255,0.06)":"none"
          }}
        >
          <span style={{
            color:"rgba(255,255,255,0.38)",
            width:50
          }}>
            {i===0?"Now":fmtHour(h.t)}
          </span>

          <span style={{fontSize:20}}>
            {(WMO[h.code]||WMO[0]).i}
          </span>

          <span style={{flex:1,fontWeight:500}}>
            {deg(h.temp)}
          </span>

          <span style={{
            color:"#7dd3fc",
            width:48,
            textAlign:"right"
          }}>
            {h.pop>0?`💧${h.pop}%`:""}
          </span>

          <span style={{
            color:"rgba(255,255,255,0.3)",
            width:65,
            textAlign:"right"
          }}>
            {Math.round(h.wind)}km/h
          </span>
        </div>
      ))}
    </div>
  </div>
)}

          {tab==="week"&&daily&&(
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
                      <span style={{color:"rgba(255,255,255,0.1)"}}>·</span>
                      <span style={{fontSize:15,fontWeight:600}}>{deg(daily.temperature_2m_max[i])}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==="details"&&(
  <div style={{padding:"0 14px"}}>

    <div style={{
      fontSize:10,
      color:"rgba(255,255,255,0.28)",
      textTransform:"uppercase",
      letterSpacing:1.5,
      marginBottom:10
    }}>
      Current Conditions
    </div>

    <div style={{...G.md,borderRadius:18,overflow:"hidden",marginBottom:12}}>
      {[
        ["Temperature",deg(cur.temperature_2m)],
        ["Feels Like",deg(cur.apparent_temperature)],
        ["Dew Point",deg(cur.dew_point_2m)],
        ["Humidity",`${cur.relative_humidity_2m}%`],
        ["Cloud Cover",`${cur.cloud_cover}%`],
        ["Visibility",`${(cur.visibility/1000).toFixed(1)} km`],
        ["Precipitation",`${cur.precipitation} mm`],
        ["Pressure",`${Math.round(cur.surface_pressure)} hPa`],
        ["UV Index",`${cur.uv_index} — ${uvLabel(cur.uv_index)}`],
        ["Wind Speed",`${Math.round(cur.wind_speed_10m)} km/h`],
        ["Wind Gusts",`${Math.round(cur.wind_gusts_10m)} km/h`],
        ["Wind Dir",`${dirLabel(cur.wind_direction_10m)} (${Math.round(cur.wind_direction_10m)}°)`],
        ["Sunrise", daily?.sunrise?.[0] ? fmtTS(daily.sunrise[0]) : "—"],
["Sunset", daily?.sunset?.[0] ? fmtTS(daily.sunset[0]) : "—"],
["Timezone", wx?.meteo?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone]
      ].map(([l,v],i,a)=>(
        <Row
          key={l}
          label={l}
          value={v}
          last={i===a.length-1}
        />
      ))}
    </div>

    <div style={{
      ...G.sm,
      borderRadius:14,
      padding:"12px 16px",
      fontSize:11,
      color:"rgba(255,255,255,0.22)"
    }}>
      Data: Open-Meteo + OpenWeatherMap · {wx.lat.toFixed(4)}, {wx.lon.toFixed(4)}
    </div>
  </div>
)}

      {!wx&&!busy&&!err&&(
        <div style={{textAlign:"center",padding:60,color:"rgba(255,255,255,0.22)",fontSize:13}}>Allow location or search a city</div>
      )}
    </div>
  );
}
