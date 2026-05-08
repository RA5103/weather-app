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

// AQI Colors & Labels
const AQI_COLORS = {1:"#10b981",2:"#10b981",3:"#f59e0b",4:"#f59e0b",5:"#ef4444",6:"#7c2d12",7:"#7c2d12",8:"#1f2937",9:"#1f2937"};
const AQI_LABELS = {1:"Good",2:"Fair",3:"Moderate",4:"Poor",5:"Very Poor",6:"Hazardous",7:"Hazardous",8:"Hazardous",9:"Hazardous"};

const uvLabel  = i => i<=2?"Low":i<=5?"Moderate":i<=7?"High":i<=10?"Very High":"Extreme";
const dirLabel = d => ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(d/22.5)%16];
const fmtHour  = iso => new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",hour12:true});
const fmtDay   = iso => new Date(iso).toLocaleDateString("en-US",{weekday:"short"});
const fmtTS    = val => {
  if(!val) return "—";
  try {
    const d = typeof val==="number" ? new Date(val*1000) : new Date(val);
    if(isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  } catch { return "—"; }
};

const G = {
  sm:{background:"rgba(255,255,255,0.08)",backdropFilter:"blur(20px) saturate(160%)",WebkitBackdropFilter:"blur(20px) saturate(160%)",border:"1px solid rgba(255,255,255,0.15)",boxShadow:"0 4px 24px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.18)"},
  md:{background:"rgba(255,255,255,0.10)",backdropFilter:"blur(32px) saturate(180%)",WebkitBackdropFilter:"blur(32px) saturate(180%)",border:"1px solid rgba(255,255,255,0.20)",boxShadow:"0 8px 32px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.22)"},
  lg:{background:"rgba(255,255,255,0.13)",backdropFilter:"blur(48px) saturate(200%)",WebkitBackdropFilter:"blur(48px) saturate(200%)",border:"1px solid rgba(255,255,255,0.28)",boxShadow:"0 16px 48px rgba(0,0,0,0.3),inset 0 1.5px 0 rgba(255,255,255,0.3)"},
};

const Card = memo(({label,value,sub,color}) => (
  <div style={{...G.md,borderRadius:20,padding:"14px 16px",borderLeft:color?`3px solid ${color}`:"none"}}>
    <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>{label}</div>
    <div style={{fontSize:22,fontWeight:500}}>{value}</div>
    {sub && <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3}}>{sub}</div>}
  </div>
));

const QuickAction = memo(({icon,label,onClick,active}) => (
  <button (
  <button onClick={onClick} style={{
    ...G.sm, padding:"12px 10px", borderRadius:14, minWidth:68, height:68,
    display:"flex", flexDirection:"column", alignItems:"center", gap:4,
    background: active ? "rgba(255,255,255,0.15)" : "transparent",
    border: active ? "1px solid rgba(255,255,255,0.3)" : G.sm.border
  }}>
    <div style={{fontSize:24, lineHeight:1}}>{icon}</div>
    <div style={{fontSize:11, color:"rgba(255,255,255,0.7)", textAlign:"center", lineHeight:1.2}}>{label}</div>
  </button>
));

const Row = memo(({label,value,last}) => (
  <div style={{display:"flex",justifyContent:"space-between",padding:"11px 16px",fontSize:13,borderBottom:last?"none":"1px solid rgba(255,255,255,0.06)"}}>
    <span style={{color:"rgba(255,255,255,0.4)"}}>{label}</span>
    <span>{value}</span>
  </div>
));

const UnitToggle = memo(({unit,onToggle}) => (
  <div onClick={onToggle} style={{
    width:72,height:44,borderRadius:16,cursor:"pointer",position:"relative",flexShrink:0,
    ...G.sm,display:"flex",alignItems:"center",padding:"4px",userSelect:"none",
  }}>
    <div style={{
      position:"absolute",top:4,left:4,width:30,height:36,borderRadius:12,
      background:"rgba(255,255,255,0.22)",
      boxShadow:"0 2px 10px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.3)",
      transform:unit==="F"?"translateX(34px)":"translateX(0)",
      transition:"transform 0.22s cubic-bezier(.4,0,.2,1)",
    }}/>
    <span style={{flex:1,textAlign:"center",fontSize:11,fontWeight:600,color:unit==="C"?"#fff":"rgba(255,255,255,0.35)",zIndex:1,transition:"color 0.2s"}}>°C</span>
    <span style={{flex:1,textAlign:"center",fontSize:11,fontWeight:600,color:unit==="F"?"#fff":"rgba(255,255,255,0.35)",zIndex:1,transition:"color 0.2s"}}>°F</span>
  </div>
));

const RefreshButton = memo(({onRefresh, refreshing}) => (
  <button onClick={onRefresh} disabled={refreshing}
    style={{
      position:"fixed", bottom:24, right:24, zIndex:1000,
      ...G.lg, borderRadius:20, width:56, height:56, cursor:refreshing?"default":"pointer",
      border:G.lg.border, display:"flex", alignItems:"center", justifyContent:"center",
      padding:0, boxShadow:"0 12px 40px rgba(0,120,255,0.3)"
    }}
    title={`Refresh weather data (Updated: ${lastRefresh || 'Never'})`}
  >
    {refreshing ? (
      <div style={{
        width:24, height:24, border:"2px solid rgba(255,255,255,0.12)",
        borderTop:"2px solid rgba(255,255,255,0.8)", borderRadius:"50%",
        animation:"spin 0.75s linear infinite"
      }}/>
    ) : (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
    )}
  </button>
));

async function fetchPreview(lat,lon){
  const r = await fetch(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm10,pm2_5,no2,ozone&timezone=auto`
  ).then(r=>r.json()).catch(()=>null);
  return r?.hourly;
}

export default function WeatherApp(){
  const [wx,       setWx]      = useState(null);
  const [loc,      setLoc]     = useState(null);
  const [err,      setErr]     = useState(null);
  const [busy,     setBusy]    = useState(false);
  const [q,        setQ]       = useState("");
  const [sugs,     setSugs]    = useState([]);
  const [open,     setOpen]    = useState(false);
  const [tab,      setTab]     = useState("today");
  const [unit,     setUnit]    = useState("C");
  const [hi,       setHi]      = useState(-1);
  const [menuOpen, setMenuOpen]= useState(false);
  const [saved,    setSaved]   = useState(()=>{try{return JSON.parse(localStorage.getItem("wx_saved")||"[]")}catch{return []}});
  const [previews, setPreviews]= useState({});
  const [localTime, setLocalTime] = useState({date: "", time: ""});
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [aqiData, setAqiData] = useState(null);
  const [pinned, setPinned] = useState([]);

  const searchRef = useRef(null);
  const menuRef   = useRef(null);
  const dRef      = useRef(null);
  const timeRef   = useRef();

  const deg = useCallback(v=>`${Math.round(unit==="C"?v:v*9/5+32)}${unit}`,[unit]);

  // Dynamic background based on weather/time
  const getBgGradient = () => {
    if (!wx?.meteo?.current) return "linear-gradient(135deg,#080818 0%,#0d1b3e 35%,#1a0a2e 65%,#080c1a 100%)";
    const isDay = wx.meteo.current.is_day;
    const code = wx.meteo.current.weather_code;
    const isRainy = [61,63,65,80,81,82].includes(code);
    const isNight = !isDay;
    
    if (isRainy) return "linear-gradient(135deg,#0a0a1f 0%,#1a1a3a 35%,#2a1a4a 65%,#0a0a1f 100%)";
    if (isNight) return "linear-gradient(135deg,#000 0%,#0a1428 35%,#1a0a2e 65%,#000 100%)";
    return "linear-gradient(135deg,#0d47a1 0%,#1976d2 35%,#42a5f5 65%,#1e88e5 100%)";
  };

  useEffect(()=>{ localStorage.setItem("wx_saved",JSON.stringify(saved)); },[saved]);

  useEffect(()=>{
    saved.slice(0,4).forEach(async s=>{
      try{
        const p = await fetchPreview(s.lat,s.lon);
        setPreviews(prev=>({...prev,[s.name]:p}));
      }catch{}
    });
  },[saved]);

  useEffect(() => {
    const updateLocalTime = () => {
      if (!wx?.meteo?.timezone) return;
      const now = new Date();
      const localDate = now.toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        timeZone: wx.meteo.timezone 
      });
      const localTimeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true, timeZone: wx.meteo.timezone 
      });
      setLocalTime({ date: localDate, time: localTimeStr });
    };
    timeRef.current = setInterval(updateLocalTime, 1000);
    updateLocalTime();
    return () => clearInterval(timeRef.current);
  }, [wx?.meteo?.timezone]);

  useEffect(() => {
    if (!wx?.lat || !wx?.lon) return;
    const interval = setInterval(() => refreshData(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [wx?.lat, wx?.lon]);

  const load = useCallback(async(lat,lon,name)=>{
    setBusy(true); setErr(null); setOpen(false); setSugs([]); setMenuOpen(false);
    try{
      const [meteo,aqi] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,` +
          `surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,visibility,is_day,dew_point_2m,cloud_cover` +
          `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,precipitation` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,` +
          `precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max` +
          `&timezone=auto&forecast_days=7`
        ).then(r=>r.json()),
        fetchPreview(lat,lon)
      ]);
      setWx({meteo,lat,lon}); 
      setAqiData(aqi);
      setLoc(name); 
      setQ("");
      setLastRefresh(new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
    }catch{ setErr("Could not load weather. Check connection."); }
    finally{ setBusy(false); }
  },[]);

  const refreshData = useCallback(async () => {
    if (!wx?.lat || !wx?.lon || !loc) return;
    setRefreshing(true);
    try {
      await load(wx.lat, wx.lon, loc);
    } catch (error) {
      setErr("Refresh failed. Check connection.");
    } finally {
      setRefreshing(false);
    }
  }, [wx?.lat, wx?.lon, loc, load]);

  const gps = useCallback(()=>{
    if(!navigator.geolocation){ setErr("Geolocation not supported."); return; }
    setBusy(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      async pos=>{
        const {latitude:lat,longitude:lon} = pos.coords;
        try{
          const gc = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          ).then(r=>r.json());
          const name = gc.city||gc.locality||gc.principalSubdivision||"My Location";
          load(lat,lon,name);
        }catch{ load(lat,lon,"My Location"); }
      },
      e=>{
        setBusy(false);
        if(e.code===1) setErr("Location denied. Please allow location access.");
        else if(e.code===2) setErr("Location unavailable. Try searching instead.");
        else setErr("Location timed out. Try searching instead.");
      },
      {enableHighAccuracy:true,timeout:10000,maximumAge:60000}
    );
  },[load]);

  useEffect(()=>{
    if(q.length<2){ setSugs([]); setOpen(false); return; }
    clearTimeout(dRef.current);
    dRef.current = setTimeout(async()=>{
      try{
        const r = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`
        ).then(r=>r.json());
        const results = r.results||[];
        setSugs(results); setOpen(results.length>0); setHi(-1);
      }catch{ setSugs([]); setOpen(false); }
    },300);
    return ()=>clearTimeout(dRef.current);
  },[q]);

  useEffect(()=>{
    const fn = e=>{
      if(searchRef.current&&!searchRef.current.contains(e.target)) setOpen(false);
      if(menuRef.current&&!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown",fn);
    return ()=>document.removeEventListener("mousedown",fn);
  },[]);

  useEffect(()=>{ gps(); },[]);

  const pick = s => load(s.latitude,s.longitude,s.name);
  const saveLocation = ()=>{if(!wx||!loc||saved.find(s=>s.name===loc)) return; setSaved(prev=>[...prev,{name:loc,lat:wx.lat,lon:wx.lon}]);};
  const removeLocation = (name,e)=>{e.stopPropagation(); setSaved(prev=>prev.filter(s=>s.name!==name));};
  const pinLocation = (name) => setPinned(prev => prev.includes(name) ? prev.filter(p=>p!==name) : [name, ...prev.slice(0,3)]);

  const isSaved = saved.find(s=>s.name===loc);
  const cur    = wx?.meteo?.current;
  const daily  = wx?.meteo?.daily;
  const hourly = wx?.meteo?.hourly;
  const now    = Date.now();
  const aqiIndex = aqiData?.pm2_5 ? Math.min(9, Math.round(Math.log(aqiData.pm2_5[0] + 1) * 2.5)) : 1;
  const aqiColor = aqiIndex ? AQI_COLORS[aqiIndex] : "#10b981";
  const nextRain = hourly?.precipitation?.findIndex((p,i)=>p>0 && new Date(hourly.time[i]) > now) || -1;

  const hrs = hourly ? hourly.time.reduce((a,t,i)=>{
    if(new Date(t)>=now && a.length<24)
      a.push({t,temp:hourly.temperature_2m[i],pop:hourly.precipitation_probability[i],code:hourly.weather_code[i],wind:hourly.wind_speed_10m[i],precip:hourly.precipitation[i]});
    return a;
  },[]) : [];

  const quickActions = [
    {icon:"💧",label:nextRain>=0?`${nextRain}h`:cur?.precipitation>0?"Now":"Dry",tab:"hourly",color:"#3b82f6"},
    {icon:"💨",label:`${Math.round(cur?.wind_speed_10m||0)}`,tab:"today",color:"#f59e0b"},
    {icon:"☀️",label:cur?.uv_index||0,tab:"today",color:"#eab308"},
    {icon:"🌡️",label:deg(cur?.apparent_temperature),tab:"today",color:"#ec4899"},
    {icon:"💨",label:`${Math.round(cur?.relative_humidity_2m||0)}%`,tab:"today",color:"#06b6d4"}
  ];

  return (
    <div style={{minHeight:"100vh",background:getBgGradient(),color:"#fff",fontFamily:"-apple-system,BlinkMacSystemFont,Arial,sans-serif",maxWidth:430,margin:"0 auto",padding:"0 0 120px",position:"relative",overflow:"hidden"}}>

      {/* Animated particles */}
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,pointerEvents:"none",zIndex:1,overflow:"hidden"}}>
        {[...Array(20)].map((_,i)=>(
          <div key={i} style={{
            position:"absolute", width:2, height:2, background:"rgba(255,255,255,0.3)",
            left:`${Math.random()*100}%`, top:`${Math.random()*100}%`,
            animation:`float ${8+Math.random()*4}s linear infinite`,
            borderRadius:"50%"
          }}/>
        ))}
      </div>

      <style>{`
        *{box-sizing:border-box}
        input::placeholder{color:rgba(255,255,255,0.28)}
        ::-webkit-scrollbar{display:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes float{0%,100%{transform:translateY(0px) rotate(0deg)}50%{transform:translateY(-20px) rotate(180deg)}}
        .sug:hover{background:rgba(255,255,255,0.1)!important}
        .tab:active,.icobtn:active{transform:scale(.94)}
        .locrow:hover{background:rgba(255,255,255,0.06)!important}
      `}</style>

      {/* Top bar */}
      <div style={{padding:"18px 14px 0",position:"relative",zIndex:20,display:"flex",gap:8,alignItems:"flex-start"}}>

        {/* Hamburger */}
        <div ref={menuRef} style={{position:"relative",flexShrink:0}}>
          <button className="icobtn" onClick={()=>setMenuOpen(m=>!m)}
            style={{...G.lg,borderRadius:16,color:"#fff",width:44,height:44,cursor:"pointer",border:G.lg.border,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,padding:0,transition:"all 0.15s"}}>
            <span style={{display:"block",width:16,height:1.5,background:"#fff",borderRadius:2,transition:"all 0.22s",transform:menuOpen?"rotate(45deg) translate(2px,3.5px)":"none"}}/>
            <span style={{display:"block",width:16,height:1.5,background:"#fff",borderRadius:2,transition:"all 0.22s",opacity:menuOpen?0:1}}/>
            <span style={{display:"block",width:16,height:1.5,background:"#fff",borderRadius:2,transition:"all 0.22s",transform:menuOpen?"rotate(-45deg) translate(2px,-3.5px)":"none"}}/>
          </button>

          {menuOpen && (
            <div style={{position:"absolute",top:52,left:0,width:265,zIndex:300,...G.lg,borderRadius:20,overflow:"hidden",animation:"slideIn 0.18s ease",boxShadow:"0 24px 60px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.22)"}}>
              <div style={{padding:"14px 16px 10px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.38)",textTransform:"uppercase",letterSpacing:1.5}}>Saved Locations</div>
              </div>

              {saved.length===0 ? (
                <div style={{padding:"22px 16px",fontSize:12,color:"rgba(255,255,255,0.25)",textAlign:"center",lineHeight:1.7}}>
                  No saved locations.<br/><span style={{color:"rgba(255,255,255,0.38)"}}>Tap + below to save.</span>
                </div>
              ) : (
                <div style={{maxHeight:280,overflowY:"auto"}}>
                  {saved.map((s,i)=>{
                    const p = previews[s.name];
                    const w = p?(WMO[p.weather_code]||WMO[0]):null;
                    const isActive = loc===s.name;
                    return (
                      <div key={s.name} className="locrow" onClick={()=>load(s.lat,s.lon,s.name)}
                        style={{padding:"12px 16px",cursor:"pointer",background:isActive?"rgba(255,255,255,0.07)":"transparent",borderBottom:i<saved.length-1?"1px solid rgba(255,255,255,0.06)":"none",display:"flex",alignItems:"center",gap:10,transition:"background 0.15s",borderLeft:isActive?"2px solid rgba(255,255,255,0.35)":"2px solid transparent"}}>
                        <div style={{fontSize:22,flexShrink:0}}>{w?w.i:"·"}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:isActive?"#fff":"rgba(255,255,255,0.82)"}}>{s.name}</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.32)",marginTop:2}}>
                            {p ? `${w.l} · ${Math.round(unit==="C"?p.temperature_2m:p.temperature_2m*9/5+32)}${unit}` : "Loading…"}
                          </div>
                        </div>
                        <div style={{fontSize:18,fontWeight:300,color:"rgba(255,255,255,0.88)",flexShrink:0,marginRight:4}}>
                          {p ? `${Math.round(unit==="C"?p.temperature_2m:p.temperature_2m*9/5+32)}${unit}` : ""}
                        </div>
                        <button onClick={e=>removeLocation(s.name,e)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.18)",cursor:"pointer",fontSize:18,padding:"0 4px",lineHeight:1,flexShrink:0}}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Unit Toggle */}
              <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.38)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>Temperature Unit</div>
                <UnitToggle unit={unit} onToggle={()=>setUnit(u=>u==="C"?"F":"C")}/>
              </div>

              {loc && (
                <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                  <button onClick={saveLocation} disabled={!!isSaved}
                    style={{width:"100%",padding:"10px",borderRadius:12,border:"none",cursor:isSaved?"default":"pointer",background:isSaved?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.1)",color:isSaved?"rgba(255,255,255,0.22)":"#fff",fontSize:12,fontFamily:"inherit",fontWeight:500,transition:"all 0.15s",letterSpacing:.4}}>
                    {isSaved ? `✓ ${loc} saved` : `+ Save ${loc}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div ref={searchRef} style={{flex:1,position:"relative"}}>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1,position:"relative"}}>
              <input
                value={q} onChange={e=>setQ(e.target.value)}
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
              {open && sugs.length>0 && (
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
            <button className="icobtn" onClick={gps} title="Use my location"
              style={{...G.lg,borderRadius:16,color:"#fff",width:44,height:44,cursor:"pointer",border:G.lg.border,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:0}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {(busy || refreshing) && (
        <div style={{textAlign:"center",padding:"64px 0",position:"relative",zIndex:10}}>
          <div style={{width:34,height:34,border:"2.5px solid rgba(255,255,255,0.08)",borderTop:"2.5px solid rgba(255,255,255,0.7)",borderRadius:"50%",margin:"0 auto",animation:"spin 0.75s linear infinite"}}/>
          <div style={{marginTop:14,color:"rgba(255,255,255,0.3)",fontSize:12,animation:"shimmer 1.5s infinite"}}>
            {refreshing ? "Refreshing…" : "Loading weather…"}
          </div>
        </div>
      )}

      {/* Error */}
      {err && !busy && !refreshing && (
        <div style={{margin:"16px 14px 0",...G.sm,borderRadius:16,padding:"13px 16px",fontSize:13,color:"#fca5a5",border:"1px solid rgba(255,80,80,0.25)",background:"rgba(255,50,50,0.07)"}}>
          ⚠️ {err}
        </div>
      )}

      {/* Main content */}
      {wx && cur && !busy && !refreshing && (
        <div style={{animation:"fadeUp 0.3s ease",position:"relative",zIndex:10}}>

          {/* Hero */}
          <div style={{padding:"26px 14px 18px",textAlign:"center"}}>
            <div style={{fontSize:78,lineHeight:1,marginBottom:8,filter:"drop-shadow(0 0 32px rgba(255,255,255,0.3))",userSelect:"none"}}>{(WMO[cur.weather_code]||WMO[0]).i}</div>
            <div style={{fontSize:84,fontWeight:300,letterSpacing:-5,lineHeight:1,marginBottom:4,textShadow:"0 0 60px rgba(255,255,255,0.2)"}}>{deg(cur.temperature_2m)}</div>
            
            <div style={{marginBottom:12}}>
              <div style={{color:"rgba(255,255,255,0.42)",fontSize:13,marginBottom:2}}>Feels like {deg(cur.apparent_temperature)}</div>
              {localTime.date && <div style={{color:"rgba(255,255,255,0.32)",fontSize:12,marginBottom:2}}>{localTime.date}</div>}
              {localTime.time && <div style={{fontSize:20,fontWeight:500,color:"rgba(255,255,255,0.65)",letterSpacing:-0.3,textShadow:"0 1px 4px rgba(0,0,0,0.3)"}}>{localTime.time}</div>}
            </div>
            
            <div style={{fontSize:15,fontWeight:500,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>{(WMO[cur.weather_code]||WMO[0]).l}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.32)",marginBottom:2}}>· {loc}</div>
            {lastRefresh && <div style={{fontSize:11,color:"rgba(255,255,255,0.25)"}}>Updated {lastRefresh} · Auto-refresh 30min</div>}
          </div>

          {/* Quick Actions */}
          <div style={{padding:"0 14px 16px",display:"flex",gap:10,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:10}}>
            {quickActions.map((action,i)=>(
              <QuickAction key={i} {...action} active={tab===action.tab} onClick={()=>setTab(action.tab)}/>
            ))}
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

          {/* TODAY */}
          {tab==="today" && (
            <div style={{padding:"0 14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Card label="Air Quality" value={aqiIndex||1} sub={AQI_LABELS[aqiIndex||1]||"Good"} color={aqiColor}/>
              <Card label="Humidity" value={`${cur.relative_humidity_2m}%`} sub={`Dew pt ${deg(cur.dew_point_2m)}`}/>
              <Card label="Wind" value={`${Math.round(cur.wind_speed_10m)} km/h`} sub={`${dirLabel(cur.wind_direction_10m)} · Gusts ${Math.round(cur.wind_gusts_10m||0)}`}/>
              <Card label="UV Index" value={cur.uv_index} sub={uvLabel(cur.uv_index)} color={cur.uv_index>5?"#f59e0b":"#10b981"}/>
              <Card label="Pressure" value={`${Math.round(cur.surface_pressure)}`} sub="hPa"/>
              <Card label="Visibility" value={`${(cur.visibility/1000).toFixed(1)}`} sub="km"/>
              <Card label="Cloud Cover" value={`${cur.cloud_cover}%`} sub={`Rain: ${cur.precipitation}mm`}/>
              <Card label="Sunrise" value={fmtTS(daily?.sunrise?.[0])}/>
              <Card label="Sunset" value={fmtTS(daily?.sunset?.[0])}/>
              {daily && <Card label="Today High" value={deg(daily.temperature_2m_max[0])}/>}
              {daily && <Card label="Today Low" value={deg(daily.temperature_2m_min[0])}/>}
            </div>
          )}

          {/* HOURLY */}
          {tab==="hourly" && (
            <div style={{padding:"0 14px"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Next 24 Hours</div>
              <div style={{...G.md,borderRadius:18,overflow:"hidden"}}>
                {hrs.map((h,i,a)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",fontSize:13,borderBottom:i<a.length-1?"1px solid rgba(255,255,255,0.06)":"none"}}>
                    <span style={{color:"rgba(255,255,255,0.38)",width:50}}>{i===0?"Now":fmtHour(h.t)}</span>
                    <span style={{fontSize:20}}>{(WMO[h.code]||WMO[0]).i}</span>
                    <span style={{flex:1,fontWeight:500}}>{deg(h.temp)}</span>
                    <span style={{color:"#7dd3fc",width:48,textAlign:"right"}}>{h.pop>0?`💧${h.pop}%`:""} {h.precip>0&&`(${h.precip}mm)`}</span>
                    <span style={{color:"rgba(255,255,255,0.3)",width:65,textAlign:"right"}}>{Math.round(h.wind)}km/h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WEEK */}
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
                      <span style={{color:"rgba(255,255,255,0.1)"}}>·</span>
                      <span style={{fontSize:15,fontWeight:600}}>{deg(daily.temperature_2m_max[i])}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DETAILS */}
          {tab==="details" && (
            <div style={{padding:"0 14px"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Current Conditions</div>
              <div style={{...G.md,borderRadius:18,overflow:"hidden",marginBottom:12}}>
                {[
                  ["Temperature", deg(cur.temperature_2m)],
                  ["Feels Like", deg(cur.apparent_temperature)],
                  ["Dew Point", deg(cur.dew_point_2m)],
                  ["Humidity", `${cur.relative_humidity_2m}%`],
                  ["Cloud Cover", `${cur.cloud_cover}%`],
                  ["Visibility", `${(cur.visibility/1000).toFixed(1)} km`],
                  ["Precipitation", `${cur.precipitation} mm`],
                  ["Pressure", `${Math.round(cur.surface_pressure)} hPa`],
                  ["UV Index", `${cur.uv_index} — ${uvLabel(cur.uv_index)}`],
                  ["Wind Speed", `${Math.round(cur.wind_speed_10m)} km/h`],
                  ["Wind Gusts", `${Math.round(cur.wind_gusts_10m||0)} km/h`],
                  ["Wind Dir", `${dirLabel(cur.wind_direction_10m)} (${Math.round(cur.wind_direction_10m)}°)`],
                  ["Sunrise", fmtTS(daily?.sunrise?.[0])],
                  ["Sunset", fmtTS(daily?.sunset?.[0])],
                  ["Timezone", wx?.meteo?.timezone||"—"],
                ].map(([l,v],i,a)=><Row key={l} label={l} value={v} last={i===a.length-1}/>)}
              </div>
              <div style={{...G.sm,borderRadius:14,padding:"12px 16px",fontSize:11,color:"rgba(255,255,255,0.22)",textAlign:"center"}}>
                Data: Open-Meteo Air Quality · {wx.lat.toFixed(4)}, {wx.lon.toFixed(4)}
              </div>
            </div>
          )}
        </div>
      )}

      {!wx && !busy && !refreshing && !err && (
        <div style={{textAlign:"center",padding:60,color:"rgba(255,255,255,0.22)",fontSize:13}}>Allow location or search a city</div>
      )}

      {/* FAB Refresh Button */}
      <RefreshButton onRefresh={refreshData} refreshing={refreshing} lastRefresh={lastRefresh}/>

    </div>
  );
}
