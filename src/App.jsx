import { useState, useEffect, useCallback, memo } from "react";

const WMO = {
  0:{l:"Clear",i:"☀️"},
  1:{l:"Mainly Clear",i:"🌤️"},
  2:{l:"Partly Cloudy",i:"⛅"},
  3:{l:"Overcast",i:"☁️"},
  45:{l:"Fog",i:"🌫️"},
  48:{l:"Icy Fog",i:"🌫️"},
  51:{l:"Light Drizzle",i:"🌦️"},
  53:{l:"Drizzle",i:"🌦️"},
  55:{l:"Heavy Drizzle",i:"🌧️"},
  61:{l:"Light Rain",i:"🌧️"},
  63:{l:"Rain",i:"🌧️"},
  65:{l:"Heavy Rain",i:"🌧️"},
  71:{l:"Light Snow",i:"🌨️"},
  73:{l:"Snow",i:"❄️"},
  75:{l:"Heavy Snow",i:"❄️"},
  80:{l:"Showers",i:"🌦️"},
  81:{l:"Heavy Showers",i:"🌧️"},
  95:{l:"Thunderstorm",i:"⛈️"},
};

const fmtHour = iso =>
  new Date(iso).toLocaleTimeString([],{
    hour:"numeric",
    hour12:true
  });

const fmtDay = iso =>
  new Date(iso).toLocaleDateString([],{
    weekday:"short"
  });

const fmtTS = val => {
  if(!val) return "—";

  try{
    const d = new Date(val);

    return d.toLocaleTimeString([],{
      hour:"2-digit",
      minute:"2-digit"
    });
  }catch{
    return "—";
  }
};

const dirLabel = d =>
  ["N","NE","E","SE","S","SW","W","NW"][Math.round(d/45)%8];

const uvLabel = i =>
  i <= 2 ? "Low" :
  i <= 5 ? "Moderate" :
  i <= 7 ? "High" :
  i <= 10 ? "Very High" :
  "Extreme";

const G = {
  md:{
    background:"rgba(255,255,255,0.10)",
    backdropFilter:"blur(20px)",
    WebkitBackdropFilter:"blur(20px)",
    border:"1px solid rgba(255,255,255,0.12)",
    boxShadow:"0 8px 32px rgba(0,0,0,0.2)"
  }
};

const Card = memo(({label,value,sub})=>(
  <div style={{
    ...G.md,
    borderRadius:20,
    padding:"14px 16px"
  }}>
    <div style={{
      fontSize:10,
      color:"rgba(255,255,255,0.35)",
      textTransform:"uppercase",
      marginBottom:6,
      letterSpacing:1.4
    }}>
      {label}
    </div>

    <div style={{
      fontSize:22,
      fontWeight:600
    }}>
      {value}
    </div>

    {sub && (
      <div style={{
        fontSize:11,
        marginTop:4,
        color:"rgba(255,255,255,0.4)"
      }}>
        {sub}
      </div>
    )}
  </div>
));

const Row = memo(({label,value,last})=>(
  <div style={{
    display:"flex",
    justifyContent:"space-between",
    padding:"12px 16px",
    borderBottom:last
      ? "none"
      : "1px solid rgba(255,255,255,0.06)"
  }}>
    <span style={{
      color:"rgba(255,255,255,0.4)"
    }}>
      {label}
    </span>

    <span>{value}</span>
  </div>
));

export default function App(){

  const [wx,setWx] = useState(null);
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState(null);
  const [tab,setTab] = useState("today");

  const load = useCallback(async(lat,lon)=>{

    setBusy(true);
    setErr(null);

    try{

      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}
        &current=temperature_2m,relative_humidity_2m,apparent_temperature,
        precipitation,weather_code,surface_pressure,wind_speed_10m,
        wind_direction_10m,wind_gusts_10m,uv_index,visibility,
        dew_point_2m,cloud_cover
        &hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m
        &daily=weather_code,temperature_2m_max,temperature_2m_min,
        sunrise,sunset
        &timezone=auto`
      );

      const meteo = await r.json();

      setWx({meteo});

    }catch{
      setErr("Failed to load weather.");
    }

    setBusy(false);

  },[]);

  useEffect(()=>{

    navigator.geolocation.getCurrentPosition(
      pos=>{
        load(
          pos.coords.latitude,
          pos.coords.longitude
        );
      },
      ()=>{
        load(23.8103,90.4125);
      }
    );

  },[load]);

  const cur = wx?.meteo?.current;
  const daily = wx?.meteo?.daily;
  const hourly = wx?.meteo?.hourly;

  const wmo = WMO[cur?.weather_code] || WMO[0];

  const hrs = hourly
    ? hourly.time.slice(0,24).map((t,i)=>({
        t,
        temp:hourly.temperature_2m[i],
        pop:hourly.precipitation_probability[i],
        code:hourly.weather_code[i],
        wind:hourly.wind_speed_10m[i]
      }))
    : [];

  return(
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(135deg,#080818 0%,#0d1b3e 35%,#1a0a2e 65%,#080c1a 100%)",
      color:"#fff",
      maxWidth:430,
      margin:"0 auto",
      padding:"0 0 80px",
      overflow:"hidden",
      fontFamily:'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif'
    }}>

    <style>{`
  *{
    box-sizing:border-box;
    font-family: Arial, sans-serif !important;
  }

  html, body, #root {
    font-family: Arial, sans-serif !important;
  }

  input::placeholder{
    color:rgba(255,255,255,0.28);
  }

  ::-webkit-scrollbar{
    display:none;
  }

  @keyframes fadeUp{
    from{
      opacity:0;
      transform:translateY(10px);
    }
    to{
      opacity:1;
      transform:translateY(0);
    }
  }

  @keyframes slideIn{
    from{
      opacity:0;
      transform:translateX(-12px);
    }
    to{
      opacity:1;
      transform:translateX(0);
    }
  }

  @keyframes spin{
    to{
      transform:rotate(360deg);
    }
  }

  @keyframes shimmer{
    0%,100%{
      opacity:.5;
    }

    50%{
      opacity:1;
    }
  }

  .sug:hover{
    background:rgba(255,255,255,0.1)!important;
  }

  .tab:active,
  .icobtn:active{
    transform:scale(.94);
  }

  .locrow:hover{
    background:rgba(255,255,255,0.06)!important;
  }
`}</style>

      {busy && (
        <div style={{
          textAlign:"center",
          paddingTop:120
        }}>
          Loading...
        </div>
      )}

      {err && (
        <div style={{
          textAlign:"center",
          paddingTop:120,
          color:"#fca5a5"
        }}>
          {err}
        </div>
      )}

      {wx && cur && !busy && (
        <>

          <div style={{
            textAlign:"center",
            padding:"50px 20px 24px"
          }}>

            <div style={{
              fontSize:86,
              marginBottom:12
            }}>
              {wmo.i}
            </div>

            <div style={{
              fontSize:86,
              fontWeight:300,
              lineHeight:1
            }}>
              {Math.round(cur.temperature_2m)}°
            </div>

            <div style={{
              marginTop:8,
              fontSize:14,
              color:"rgba(255,255,255,0.45)"
            }}>
              Feels like {Math.round(cur.apparent_temperature)}°
            </div>

            <div style={{
              marginTop:10,
              fontSize:16,
              textTransform:"uppercase",
              letterSpacing:2
            }}>
              {wmo.l}
            </div>

          </div>

          <div style={{
            display:"flex",
            gap:6,
            margin:"0 14px 16px",
            padding:4,
            borderRadius:18,
            ...G.md
          }}>

            {["today","hourly","week","details"].map(t=>(
              <button
                key={t}
                onClick={()=>setTab(t)}
                style={{
                  flex:1,
                  border:"none",
                  borderRadius:14,
                  padding:"10px 0",
                  background:
                    tab===t
                    ? "rgba(255,255,255,0.16)"
                    : "transparent",
                  color:
                    tab===t
                    ? "#fff"
                    : "rgba(255,255,255,0.35)",
                  cursor:"pointer"
                }}
              >
                {t}
              </button>
            ))}

          </div>

          {/* TODAY */}

          {tab==="today" && (
            <div style={{
              padding:"0 14px",
              display:"grid",
              gridTemplateColumns:"1fr 1fr",
              gap:12
            }}>

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
                label="Pressure"
                value={`${Math.round(cur.surface_pressure)} hPa`}
              />

              <Card
                label="Visibility"
                value={`${(cur.visibility/1000).toFixed(1)} km`}
              />

              <Card
                label="Cloud Cover"
                value={`${cur.cloud_cover}%`}
              />

              <Card
                label="Humidity"
                value={`${cur.relative_humidity_2m}%`}
              />

              <Card
                label="Sunrise"
                value={fmtTS(daily?.sunrise?.[0])}
              />

              <Card
                label="Sunset"
                value={fmtTS(daily?.sunset?.[0])}
              />

            </div>
          )}

          {/* HOURLY */}

          {tab==="hourly" && (
            <div style={{padding:"0 14px"}}>

              <div style={{
                ...G.md,
                borderRadius:18,
                overflow:"hidden"
              }}>

                {hrs.map((h,i)=>(
                  <div
                    key={i}
                    style={{
                      display:"flex",
                      alignItems:"center",
                      gap:10,
                      padding:"12px 16px",
                      borderBottom:
                        i < hrs.length-1
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "none"
                    }}
                  >

                    <span style={{
                      width:55,
                      color:"rgba(255,255,255,0.4)"
                    }}>
                      {fmtHour(h.t)}
                    </span>

                    <span style={{fontSize:20}}>
                      {(WMO[h.code]||WMO[0]).i}
                    </span>

                    <span style={{flex:1}}>
                      {Math.round(h.temp)}°
                    </span>

                    <span style={{
                      color:"#7dd3fc"
                    }}>
                      {h.pop}%
                    </span>

                  </div>
                ))}

              </div>

            </div>
          )}

          {/* WEEK */}

          {tab==="week" && daily && (
            <div style={{padding:"0 14px"}}>

              <div style={{
                ...G.md,
                borderRadius:18,
                overflow:"hidden"
              }}>

                {daily.time.map((d,i)=>(
                  <div
                    key={i}
                    style={{
                      display:"flex",
                      alignItems:"center",
                      padding:"14px 16px",
                      borderBottom:
                        i < daily.time.length-1
                        ? "1px solid rgba(255,255,255,0.06)"
                        : "none"
                    }}
                  >

                    <span style={{width:60}}>
                      {i===0 ? "Today" : fmtDay(d)}
                    </span>

                    <span style={{fontSize:22}}>
                      {(WMO[daily.weather_code[i]]||WMO[0]).i}
                    </span>

                    <div style={{marginLeft:"auto"}}>
                      {Math.round(daily.temperature_2m_min[i])}°
                      {" / "}
                      {Math.round(daily.temperature_2m_max[i])}°
                    </div>

                  </div>
                ))}

              </div>

            </div>
          )}

          {/* DETAILS */}

          {tab==="details" && (
            <div style={{padding:"0 14px"}}>

              <div style={{
                ...G.md,
                borderRadius:18,
                overflow:"hidden"
              }}>

                {[
                  ["Temperature",`${Math.round(cur.temperature_2m)}°`],
                  ["Feels Like",`${Math.round(cur.apparent_temperature)}°`],
                  ["Humidity",`${cur.relative_humidity_2m}%`],
                  ["Pressure",`${Math.round(cur.surface_pressure)} hPa`],
                  ["Visibility",`${(cur.visibility/1000).toFixed(1)} km`],
                  ["Wind Speed",`${Math.round(cur.wind_speed_10m)} km/h`],
                  ["Wind Gusts",`${Math.round(cur.wind_gusts_10m)} km/h`],
                  ["Wind Direction",dirLabel(cur.wind_direction_10m)],
                  ["UV Index",`${cur.uv_index} • ${uvLabel(cur.uv_index)}`],
                  ["Cloud Cover",`${cur.cloud_cover}%`],
                  ["Dew Point",`${Math.round(cur.dew_point_2m)}°`],
                  ["Sunrise",fmtTS(daily?.sunrise?.[0])],
                  ["Sunset",fmtTS(daily?.sunset?.[0])],
                  ["Timezone",wx?.meteo?.timezone || "—"]
                ].map(([l,v],i,a)=>(
                  <Row
                    key={l}
                    label={l}
                    value={v}
                    last={i===a.length-1}
                  />
                ))}

              </div>

            </div>
          )}

        </>
      )}

    </div>
  );
}
