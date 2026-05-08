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

const AQI_COLORS = {
  1:"#10b981",
  2:"#10b981",
  3:"#f59e0b",
  4:"#f59e0b",
  5:"#ef4444",
  6:"#7c2d12",
  7:"#7c2d12",
  8:"#1f2937",
  9:"#1f2937"
};

const AQI_LABELS = {
  1:"Good",
  2:"Fair",
  3:"Moderate",
  4:"Poor",
  5:"Very Poor",
  6:"Hazardous",
  7:"Hazardous",
  8:"Hazardous",
  9:"Hazardous"
};

const uvLabel = i =>
  i<=2 ? "Low" :
  i<=5 ? "Moderate" :
  i<=7 ? "High" :
  i<=10 ? "Very High" :
  "Extreme";

const dirLabel = d =>
  ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(d/22.5)%16];

const fmtHour = iso =>
  new Date(iso).toLocaleTimeString("en-US",{
    hour:"numeric",
    hour12:true
  });

const fmtDay = iso =>
  new Date(iso).toLocaleDateString("en-US",{
    weekday:"short"
  });

const fmtTS = val => {
  if(!val) return "—";

  try{
    const d = typeof val==="number"
      ? new Date(val*1000)
      : new Date(val);

    if(isNaN(d.getTime())) return "—";

    return d.toLocaleTimeString([],{
      hour:"2-digit",
      minute:"2-digit"
    });
  }catch{
    return "—";
  }
};

const G = {
  sm:{
    background:"rgba(255,255,255,0.08)",
    backdropFilter:"blur(20px)",
    WebkitBackdropFilter:"blur(20px)",
    border:"1px solid rgba(255,255,255,0.15)"
  },
  md:{
    background:"rgba(255,255,255,0.10)",
    backdropFilter:"blur(30px)",
    WebkitBackdropFilter:"blur(30px)",
    border:"1px solid rgba(255,255,255,0.15)"
  },
  lg:{
    background:"rgba(255,255,255,0.14)",
    backdropFilter:"blur(40px)",
    WebkitBackdropFilter:"blur(40px)",
    border:"1px solid rgba(255,255,255,0.2)"
  }
};

const Card = memo(({label,value,sub,color}) => (
  <div
    style={{
      ...G.md,
      borderRadius:20,
      padding:"14px 16px",
      borderLeft:color ? `3px solid ${color}` : "none"
    }}
  >
    <div
      style={{
        fontSize:10,
        color:"rgba(255,255,255,0.35)",
        textTransform:"uppercase",
        letterSpacing:1.5,
        marginBottom:6
      }}
    >
      {label}
    </div>

    <div style={{fontSize:22,fontWeight:500}}>
      {value}
    </div>

    {sub && (
      <div
        style={{
          fontSize:11,
          color:"rgba(255,255,255,0.45)",
          marginTop:3
        }}
      >
        {sub}
      </div>
    )}
  </div>
));

const UnitToggle = memo(({unit,onToggle}) => (
  <div
    onClick={onToggle}
    style={{
      width:72,
      height:44,
      borderRadius:16,
      cursor:"pointer",
      position:"relative",
      flexShrink:0,
      ...G.sm,
      display:"flex",
      alignItems:"center",
      padding:"4px"
    }}
  >
    <div
      style={{
        position:"absolute",
        top:4,
        left:4,
        width:30,
        height:36,
        borderRadius:12,
        background:"rgba(255,255,255,0.2)",
        transform:unit==="F"
          ? "translateX(34px)"
          : "translateX(0)",
        transition:"transform .2s"
      }}
    />

    <span
      style={{
        flex:1,
        textAlign:"center",
        fontSize:11,
        fontWeight:600,
        zIndex:1,
        color:unit==="C"
          ? "#fff"
          : "rgba(255,255,255,0.35)"
      }}
    >
      °C
    </span>

    <span
      style={{
        flex:1,
        textAlign:"center",
        fontSize:11,
        fontWeight:600,
        zIndex:1,
        color:unit==="F"
          ? "#fff"
          : "rgba(255,255,255,0.35)"
      }}
    >
      °F
    </span>
  </div>
));

const RefreshButton = memo(({onRefresh, refreshing, lastRefresh}) => (
  <button
    onClick={onRefresh}
    disabled={refreshing}
    title={`Updated: ${lastRefresh || "Never"}`}
    style={{
      position:"fixed",
      bottom:24,
      right:24,
      zIndex:1000,
      ...G.lg,
      borderRadius:20,
      width:56,
      height:56,
      cursor:"pointer",
      border:G.lg.border,
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      color:"#fff"
    }}
  >
    {refreshing ? "⟳" : "↻"}
  </button>
));

async function fetchPreview(lat,lon){
  const r = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
  )
    .then(r=>r.json())
    .catch(()=>null);

  return r?.current;
}

export default function WeatherApp(){

  const [wx,setWx] = useState(null);
  const [loc,setLoc] = useState(null);
  const [err,setErr] = useState(null);
  const [busy,setBusy] = useState(false);
  const [unit,setUnit] = useState("C");
  const [refreshing,setRefreshing] = useState(false);
  const [lastRefresh,setLastRefresh] = useState(null);

  const deg = useCallback(v =>
    `${Math.round(unit==="C" ? v : (v*9/5)+32)}°${unit}`
  ,[unit]);

  const getBgGradient = () => {

    if(!wx?.meteo?.current){
      return "linear-gradient(135deg,#080818 0%,#0d1b3e 35%,#1a0a2e 65%,#080c1a 100%)";
    }

    const isDay = wx.meteo.current.is_day;
    const code = wx.meteo.current.weather_code;

    const rainy = [61,63,65,80,81,82].includes(code);

    if(rainy){
      return "linear-gradient(135deg,#0a0a1f 0%,#1a1a3a 35%,#2a1a4a 65%,#0a0a1f 100%)";
    }

    if(!isDay){
      return "linear-gradient(135deg,#000 0%,#0a1428 35%,#1a0a2e 65%,#000 100%)";
    }

    return "linear-gradient(135deg,#0d47a1 0%,#1976d2 35%,#42a5f5 65%,#1e88e5 100%)";
  };

  const load = useCallback(async(lat,lon,name)=>{

    setBusy(true);
    setErr(null);

    try{

      const [meteo,aqi] = await Promise.all([

        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,` +
          `surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,visibility,is_day,dew_point_2m,cloud_cover` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
          `&timezone=auto`
        ).then(r=>r.json()),

        fetchPreview(lat,lon)

      ]);

      setWx({
        meteo,
        aqi,
        lat,
        lon
      });

      setLoc(name);

      setLastRefresh(
        new Date().toLocaleTimeString([],{
          hour:"2-digit",
          minute:"2-digit"
        })
      );

    }catch{
      setErr("Could not load weather.");
    }finally{
      setBusy(false);
    }

  },[]);

  const refreshData = useCallback(async()=>{

    if(!wx?.lat || !wx?.lon || !loc) return;

    setRefreshing(true);

    try{
      await load(wx.lat,wx.lon,loc);
    }finally{
      setRefreshing(false);
    }

  },[wx,loc,load]);

  const gps = useCallback(()=>{

    if(!navigator.geolocation){
      setErr("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(

      async pos => {

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        try{

          const gc = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          ).then(r=>r.json());

          const name =
            gc.city ||
            gc.locality ||
            gc.principalSubdivision ||
            "My Location";

          load(lat,lon,name);

        }catch{
          load(lat,lon,"My Location");
        }

      },

      ()=>setErr("Location access denied")

    );

  },[load]);

  useEffect(()=>{
    gps();
  },[gps]);

  const cur = wx?.meteo?.current;
  const daily = wx?.meteo?.daily;

  const aqiIndex = 1;
  const aqiColor = AQI_COLORS[aqiIndex];

  return (

    <div
      style={{
        minHeight:"100vh",
        background:getBgGradient(),
        color:"#fff",
        fontFamily:"Arial,sans-serif",
        maxWidth:430,
        margin:"0 auto",
        padding:"20px 14px 120px"
      }}
    >

      <style>{`
        *{
          box-sizing:border-box
        }

        body{
          margin:0
        }

        @keyframes spin{
          to{
            transform:rotate(360deg)
          }
        }
      `}</style>

      {busy && (
        <div style={{textAlign:"center",paddingTop:120}}>
          Loading...
        </div>
      )}

      {err && (
        <div
          style={{
            padding:14,
            borderRadius:16,
            background:"rgba(255,0,0,0.1)"
          }}
        >
          {err}
        </div>
      )}

      {wx && cur && !busy && (

        <>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>

            <div>
              <div style={{fontSize:32,fontWeight:700}}>
                {loc}
              </div>

              <div style={{color:"rgba(255,255,255,0.6)"}}>
                {(WMO[cur.weather_code] || WMO[0]).l}
              </div>
            </div>

            <UnitToggle
              unit={unit}
              onToggle={() =>
                setUnit(u => u==="C" ? "F" : "C")
              }
            />

          </div>

          <div style={{textAlign:"center",padding:"40px 0 30px"}}>

            <div style={{fontSize:90}}>
              {(WMO[cur.weather_code] || WMO[0]).i}
            </div>

            <div
              style={{
                fontSize:88,
                fontWeight:300,
                lineHeight:1
              }}
            >
              {deg(cur.temperature_2m)}
            </div>

            <div
              style={{
                marginTop:10,
                color:"rgba(255,255,255,0.6)"
              }}
            >
              Feels like {deg(cur.apparent_temperature)}
            </div>

          </div>

          <div
            style={{
              display:"grid",
              gridTemplateColumns:"1fr 1fr",
              gap:10
            }}
          >

            <Card
              label="Humidity"
              value={`${cur.relative_humidity_2m}%`}
            />

            <Card
              label="Wind"
              value={`${Math.round(cur.wind_speed_10m)} km/h`}
              sub={dirLabel(cur.wind_direction_10m)}
            />

            <Card
              label="UV Index"
              value={cur.uv_index}
              sub={uvLabel(cur.uv_index)}
            />

            <Card
              label="Visibility"
              value={`${(cur.visibility/1000).toFixed(1)} km`}
            />

            <Card
              label="Pressure"
              value={`${Math.round(cur.surface_pressure)} hPa`}
            />

            <Card
              label="Cloud Cover"
              value={`${cur.cloud_cover}%`}
            />

            <Card
              label="Air Quality"
              value={aqiIndex}
              sub={AQI_LABELS[aqiIndex]}
              color={aqiColor}
            />

            <Card
              label="Dew Point"
              value={deg(cur.dew_point_2m)}
            />

          </div>

          {daily && (

            <div style={{marginTop:20}}>

              <div
                style={{
                  fontSize:12,
                  letterSpacing:1,
                  marginBottom:10,
                  opacity:0.6
                }}
              >
                7 DAY FORECAST
              </div>

              <div
                style={{
                  ...G.md,
                  borderRadius:18,
                  overflow:"hidden"
                }}
              >

                {daily.time.map((t,i)=>(

                  <div
                    key={i}
                    style={{
                      display:"flex",
                      alignItems:"center",
                      justifyContent:"space-between",
                      padding:"14px 16px",
                      borderBottom:i<6
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "none"
                    }}
                  >

                    <div style={{width:60}}>
                      {i===0 ? "Today" : fmtDay(t)}
                    </div>

                    <div style={{fontSize:24}}>
                      {(WMO[daily.weather_code[i]] || WMO[0]).i}
                    </div>

                    <div style={{display:"flex",gap:10}}>
                      <span style={{opacity:0.5}}>
                        {deg(daily.temperature_2m_min[i])}
                      </span>

                      <span>
                        {deg(daily.temperature_2m_max[i])}
                      </span>
                    </div>

                  </div>

                ))}

              </div>

            </div>

          )}

        </>

      )}

      <RefreshButton
        onRefresh={refreshData}
        refreshing={refreshing}
        lastRefresh={lastRefresh}
      />

    </div>

  );
}
