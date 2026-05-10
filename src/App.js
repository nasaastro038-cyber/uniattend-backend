import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:5000/api";
const POLL_INTERVAL = 3000;
const fmtTime = () => new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
const TODAY   = new Date().toISOString().split("T")[0];
const AVATAR_COLORS = ["#0ea5e9","#8b5cf6","#ec4899","#f59e0b","#10b981","#ef4444","#6366f1","#14b8a6"];

async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { "Content-Type": "application/json" }, ...opts,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

async function apiPost(path, body) {
  return apiFetch(path, { method: "POST", body: JSON.stringify(body) });
}

async function apiUpload(path, formData) {
  try {
    const res  = await fetch(API + path, { method: "POST", body: formData });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

function useToast() {
  const [list, setList] = useState([]);
  const add = (msg, type = "success") => {
    const id = Date.now() + Math.random();
    setList(l => [...l, { id, msg, type }]);
    setTimeout(() => setList(l => l.filter(x => x.id !== id)), 4500);
  };
  const remove = id => setList(l => l.filter(x => x.id !== id));
  return { list, add, remove };
}

function Toasts({ list, remove }) {
  return (
    <div style={{position:"fixed",top:20,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {list.map(t => (
        <div key={t.id} style={{
          pointerEvents:"all",display:"flex",alignItems:"center",gap:10,
          background:t.type==="success"?"#022c22":t.type==="error"?"#2d0a0a":"#0c1a3a",
          border:`1px solid ${t.type==="success"?"#16a34a":t.type==="error"?"#dc2626":"#3b82f6"}`,
          color:"#f1f5f9",padding:"12px 18px",borderRadius:14,minWidth:280,maxWidth:380,
          boxShadow:"0 12px 40px rgba(0,0,0,.4)",fontFamily:"'Outfit',sans-serif",
          fontSize:14,fontWeight:500,animation:"toastIn .3s ease"
        }}>
          <span style={{fontSize:18,flexShrink:0}}>{t.type==="success"?"✅":t.type==="error"?"❌":"ℹ️"}</span>
          <span style={{flex:1}}>{t.msg}</span>
          <button onClick={()=>remove(t.id)} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:18}}>×</button>
        </div>
      ))}
    </div>
  );
}

function Avatar({ initials, idx=0, size=38 }) {
  return (
    <div style={{
      width:size,height:size,borderRadius:size*.3,flexShrink:0,
      background:`linear-gradient(135deg,${AVATAR_COLORS[idx%AVATAR_COLORS.length]},${AVATAR_COLORS[(idx+3)%AVATAR_COLORS.length]})`,
      display:"flex",alignItems:"center",justifyContent:"center",
      color:"#fff",fontWeight:800,fontSize:size*.38
    }}>{initials}</div>
  );
}

function Badge({ children, color="#3b82f6" }) {
  return <span style={{background:color+"22",color,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,textTransform:"uppercase"}}>{children}</span>;
}

function Stat({ label, value, icon, accent }) {
  return (
    <div style={{background:"#1e293b",border:`1px solid ${accent}33`,borderRadius:16,padding:"18px 22px",flex:1,minWidth:130}}>
      <div style={{fontSize:22,marginBottom:8}}>{icon}</div>
      <div style={{fontSize:30,fontWeight:800,color:"#f8fafc",lineHeight:1}}>{value}</div>
      <div style={{fontSize:12,color:"#94a3b8",marginTop:4,fontWeight:500}}>{label}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
      <div style={{width:32,height:32,borderRadius:"50%",border:"3px solid #334155",borderTopColor:"#3b82f6",animation:"spin .7s linear infinite"}}/>
    </div>
  );
}

function ConnectionBanner({ ok }) {
  if (ok === null) return null;
  return (
    <div style={{
      background:ok?"#022c22":"#2d0a0a",
      border:`1px solid ${ok?"#16a34a":"#dc2626"}`,
      borderRadius:12,padding:"10px 16px",fontSize:13,fontWeight:600,
      color:ok?"#22c55e":"#ef4444",display:"flex",alignItems:"center",gap:8,marginBottom:16
    }}>
      {ok?"🟢 Connected to Flask backend (http://localhost:5000)":"🔴 Cannot reach Flask backend — run: python app.py"}
    </div>
  );
}

const INP = {width:"100%",background:"#0f172a",border:"1.5px solid #334155",borderRadius:12,padding:"12px 16px",color:"#f8fafc",fontFamily:"'Outfit',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"};
const LBL = {display:"block",fontSize:11,fontWeight:700,color:"#64748b",letterSpacing:".6px",textTransform:"uppercase",marginBottom:7};
const BTN = {background:"#2563eb",border:"none",borderRadius:12,padding:"12px 26px",color:"#fff",fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 4px 20px #2563eb40"};
const TH  = {padding:"13px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:"#64748b",letterSpacing:".5px",textTransform:"uppercase",whiteSpace:"nowrap"};
const TD  = {padding:"12px 16px",verticalAlign:"middle"};

// ══════════════════════════════════════════════
//  QR SCANNER VIEW — with real camera
// ══════════════════════════════════════════════
function ScannerView({ students, courses, toast, connected }) {
  const [inputId,  setInputId]  = useState("");
  const [course,   setCourse]   = useState(courses[0] || {});
  const [lastScan, setLastScan] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [recent,   setRecent]   = useState([]);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef    = useRef();
  const streamRef   = useRef();
  const scanLoopRef = useRef();
  const inputRef    = useRef();

  const loadRecent = useCallback(async () => {
    if (!course.code) return;
    const { data } = await apiFetch(`/attendance?date=${TODAY}&course_id=${course.code}`);
    if (data) setRecent(data.slice(0, 8));
  }, [course.code]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(scanLoopRef.current);
      if (streamRef.current)
        streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Camera ──────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
      toast.add("📷 Camera ተከፈተ — ID card ን ፊት ያቅርቡ", "info");
      startScanLoop();
    } catch (err) {
      toast.add("❌ Camera ሊከፈት አልቻለም: " + err.message, "error");
    }
  };

  const stopCamera = () => {
    clearInterval(scanLoopRef.current);
    if (streamRef.current)
      streamRef.current.getTracks().forEach(t => t.stop());
    setCameraOn(false);
    toast.add("📷 Camera ተዘጋ", "info");
  };

  const startScanLoop = () => {
    if (!("BarcodeDetector" in window)) {
      toast.add("⚠️ Chrome ን ይጠቀሙ — BarcodeDetector ያስፈልጋል", "error");
      return;
    }
    const detector = new window.BarcodeDetector({
      formats: ["qr_code","code_128","code_39","ean_13","ean_8","data_matrix"]
    });
    let lastId = ""; let lastTs = 0;
    scanLoopRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        const codes = await detector.detect(video);
        for (const code of codes) {
          const id  = code.rawValue.trim();
          const now = Date.now();
          if (id === lastId && now - lastTs < 5000) continue;
          lastId = id; lastTs = now;
          await doScan(id);
        }
      } catch (_) {}
    }, 500);
  };

  // ── Check-in ────────────────────────────────
  const doScan = async (raw) => {
    const id = raw.trim();
    if (!id || !course.code) return;
    setLoading(true); setInputId("");
    const { data, error } = await apiPost("/attendance/checkin", {
      student_id: id, course_id: course.code
    });
    if (error) {
      if (error.includes("Already")) {
        const st = students.find(s => s.id === id);
        setLastScan({ ok:"dup", student:st, msg:error });
        toast.add(`⚠️ ${st?.name||id} አስቀድሞ ተመዝግቧል`, "info");
      } else {
        setLastScan({ ok:false, msg:error });
        toast.add(error, "error");
      }
    } else {
      setLastScan({ ok:true, student:data.student, time:data.time });
      toast.add(`✅ ${data.student.name} ተመዝግቧል!`, "success");
      loadRecent();
    }
    setLoading(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <ConnectionBanner ok={connected}/>

      {/* Course tabs */}
      <div style={{background:"#1e293b",borderRadius:18,padding:"20px 24px",border:"1px solid #334155"}}>
        <div style={{fontSize:11,color:"#64748b",fontWeight:700,letterSpacing:".8px",textTransform:"uppercase",marginBottom:12}}>Active Session</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {courses.map(c=>(
            <button key={c.code} onClick={()=>setCourse(c)} style={{
              border:course.code===c.code?"none":"1px solid #334155",
              cursor:"pointer",padding:"10px 18px",borderRadius:12,
              fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:700,
              background:course.code===c.code?"#2563eb":"#0f172a",
              color:course.code===c.code?"#fff":"#94a3b8",
              boxShadow:course.code===c.code?"0 4px 18px #2563eb50":"none"
            }}>{c.code} · {c.name}</button>
          ))}
        </div>
        {course.dept&&<div style={{marginTop:12,fontSize:13,color:"#64748b"}}><span style={{color:"#e2e8f0",fontWeight:600}}>{course.dept}</span> · {course.time} · {TODAY}</div>}
      </div>

      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>

        {/* Scanner panel */}
        <div style={{flex:"1 1 320px",background:"#1e293b",borderRadius:18,padding:28,
          border:`2px solid ${cameraOn?"#22c55e":"#334155"}`,transition:"border-color .3s",
          display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>

          <div style={{fontSize:11,color:"#64748b",fontWeight:700,letterSpacing:".8px",textTransform:"uppercase"}}>
            QR / ID Scanner
          </div>

          {/* Camera frame */}
          <div style={{width:"100%",maxWidth:360,borderRadius:16,overflow:"hidden",
            background:"#0f172a",border:"2px solid #334155",position:"relative",
            minHeight:240,display:"flex",alignItems:"center",justifyContent:"center"}}>

            {/* Corner brackets */}
            {[{top:8,left:8},{top:8,right:8},{bottom:8,left:8},{bottom:8,right:8}].map((p,i)=>(
              <div key={i} style={{position:"absolute",...p,width:28,height:28,
                borderTop:(i<2)?"3px solid #3b82f6":"none",
                borderBottom:(i>=2)?"3px solid #3b82f6":"none",
                borderLeft:(i===0||i===2)?"3px solid #3b82f6":"none",
                borderRight:(i===1||i===3)?"3px solid #3b82f6":"none",zIndex:2}}/>
            ))}

            {/* Video element — always in DOM */}
            <video ref={videoRef}
              style={{width:"100%",borderRadius:14,display:cameraOn?"block":"none"}}
              muted playsInline/>

            {/* Scan line */}
            {cameraOn&&(
              <div style={{position:"absolute",left:12,right:12,height:3,zIndex:3,
                background:"linear-gradient(90deg,transparent,#22c55e,transparent)",
                animation:"scanLine 2s linear infinite"}}/>
            )}

            {/* Placeholder */}
            {!cameraOn&&(
              <div style={{textAlign:"center",padding:30,zIndex:1}}>
                <div style={{fontSize:52,marginBottom:10}}>📷</div>
                <div style={{fontSize:13,color:"#64748b"}}>ታች ያለውን button ይጫኑ</div>
                <div style={{fontSize:12,color:"#475569",marginTop:4}}>Camera ይከፈታል</div>
              </div>
            )}
          </div>

          {/* Camera toggle button */}
          <button onClick={cameraOn ? stopCamera : startCamera} style={{
            width:"100%",padding:"14px",borderRadius:14,border:"none",
            fontFamily:"'Outfit',sans-serif",fontSize:15,fontWeight:700,cursor:"pointer",
            background:cameraOn?"transparent":"#22c55e",
            color:cameraOn?"#ef4444":"#fff",
            border:cameraOn?"2px solid #ef4444":"none",
            boxShadow:cameraOn?"none":"0 4px 20px #22c55e40",
            transition:"all .2s"
          }}>
            {cameraOn ? "⏹  Camera ዝጋ" : "▶  Camera ክፈት — Scan ጀምር"}
          </button>

          {/* Manual input */}
          <div style={{width:"100%",display:"flex",gap:10}}>
            <input ref={inputRef} value={inputId}
              onChange={e=>setInputId(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&doScan(inputId)}
              placeholder="ወይም Student ID ን በ손으로 ይጻፉ…"
              style={{...INP,flex:1}} disabled={loading}/>
            <button onClick={()=>doScan(inputId)}
              disabled={loading||!inputId.trim()}
              style={{...BTN,padding:"12px 16px",opacity:!inputId.trim()?0.4:1}}>↵</button>
          </div>

          {/* Demo quick buttons */}
          <div style={{width:"100%"}}>
            <div style={{fontSize:10,color:"#475569",marginBottom:7,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px"}}>Demo — Click to Scan</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {students.map(s=>(
                <button key={s.id} onClick={()=>doScan(s.id)} disabled={loading} style={{
                  background:"#0f172a",border:"1px solid #334155",borderRadius:8,
                  padding:"5px 10px",color:"#94a3b8",fontSize:11,fontWeight:600,
                  cursor:"pointer",fontFamily:"'Outfit',sans-serif"
                }}>{s.name.split(" ")[0]}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Right — last result + recent */}
        <div style={{flex:"1 1 260px",display:"flex",flexDirection:"column",gap:16}}>
          {lastScan&&(
            <div style={{background:"#1e293b",borderRadius:18,padding:22,
              border:`2px solid ${lastScan.ok===true?"#22c55e":lastScan.ok==="dup"?"#f59e0b":"#ef4444"}`,
              animation:"fadeUp .3s ease"}}>
              <div style={{fontSize:10,color:"#64748b",fontWeight:700,letterSpacing:".8px",textTransform:"uppercase",marginBottom:14}}>Last Scan</div>
              {lastScan.ok===true&&(
                <>
                  <div style={{fontSize:32,marginBottom:8}}>✅</div>
                  <Avatar initials={(lastScan.student?.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2)} idx={0} size={44}/>
                  <div style={{fontSize:17,fontWeight:800,color:"#f8fafc",marginTop:10}}>{lastScan.student?.name}</div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>{lastScan.student?.id}</div>
                  <div style={{marginTop:12,background:"#022c22",border:"1px solid #16a34a",borderRadius:10,padding:"10px 14px"}}>
                    <span style={{color:"#22c55e",fontWeight:700}}>Checked in at {lastScan.time}</span>
                  </div>
                </>
              )}
              {lastScan.ok==="dup"&&(
                <>
                  <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
                  <div style={{fontWeight:700,color:"#f8fafc"}}>{lastScan.student?.name||"Student"}</div>
                  <div style={{marginTop:10,background:"#451a03",border:"1px solid #f59e0b",borderRadius:10,padding:"10px 14px"}}>
                    <span style={{color:"#f59e0b",fontWeight:700}}>{lastScan.msg}</span>
                  </div>
                </>
              )}
              {lastScan.ok===false&&(
                <>
                  <div style={{fontSize:32,marginBottom:8}}>❌</div>
                  <div style={{color:"#ef4444",fontWeight:700}}>{lastScan.msg}</div>
                </>
              )}
            </div>
          )}

          <div style={{background:"#1e293b",borderRadius:18,padding:20,border:"1px solid #334155",flex:1}}>
            <div style={{fontSize:10,color:"#64748b",fontWeight:700,letterSpacing:".8px",textTransform:"uppercase",marginBottom:14}}>
              Recent Check-ins · {course.code}
            </div>
            {recent.length===0
              ?<div style={{color:"#475569",fontSize:13,textAlign:"center",paddingTop:20}}>No check-ins yet</div>
              :recent.map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #0f172a"}}>
                  <Avatar initials={r.name.split(" ").map(w=>w[0]).join("").slice(0,2)} idx={i} size={30}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{r.name}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{r.student_id}</div>
                  </div>
                  <span style={{fontSize:11,color:"#22c55e",fontWeight:700}}>{r.time}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scanLine {
          0%  { top:15%; }
          50% { top:85%; }
          100%{ top:15%; }
        }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ADMIN DASHBOARD
// ══════════════════════════════════════════════
function AdminView({ students, courses, toast, connected }) {
  const [dateFilter,   setDateFilter]   = useState(TODAY);
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [search,       setSearch]       = useState("");
  const [attendance,   setAttendance]   = useState([]);
  const [reports,      setReports]      = useState([]);
  const [lastPoll,     setLastPoll]     = useState(null);
  const [polling,      setPolling]      = useState(true);

  const fetchData = useCallback(async () => {
    const courseQ = courseFilter!=="ALL" ? `&course_id=${courseFilter}` : "";
    const [attRes,repRes] = await Promise.all([
      apiFetch(`/attendance?date=${dateFilter}${courseQ}`),
      apiFetch("/absence-reports"),
    ]);
    if (attRes.data) setAttendance(attRes.data);
    if (repRes.data) setReports(repRes.data);
    setLastPoll(new Date().toLocaleTimeString());
  },[dateFilter,courseFilter]);

  useEffect(()=>{fetchData();},[fetchData]);
  useEffect(()=>{
    if(!polling) return;
    const id=setInterval(fetchData,POLL_INTERVAL);
    return()=>clearInterval(id);
  },[polling,fetchData]);

  const presentIds = new Set(attendance.map(r=>r.student_id));
  const excusedIds = new Set(reports.filter(r=>r.date===dateFilter).map(r=>r.student_id));

  const filteredStudents = students.filter(s=>
    (courseFilter==="ALL"||courses.find(c=>c.code===courseFilter)?.dept===s.dept)&&
    (s.name.toLowerCase().includes(search.toLowerCase())||s.id.includes(search))
  );

  const numPresent = filteredStudents.filter(s=>presentIds.has(s.id)).length;
  const numExcused = filteredStudents.filter(s=>!presentIds.has(s.id)&&excusedIds.has(s.id)).length;
  const numAbsent  = filteredStudents.length-numPresent-numExcused;
  const rate       = filteredStudents.length?Math.round((numPresent/filteredStudents.length)*100):0;

  const handleAction = async(id,status,name)=>{
    const {error}=await apiFetch(`/absence-reports/${id}`,{method:"PATCH",body:JSON.stringify({status}),headers:{"Content-Type":"application/json"}});
    if(error){toast.add(error,"error");return;}
    toast.add(`${name}'s report ${status} ✅`,"success");
    fetchData();
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <ConnectionBanner ok={connected}/>

      <div style={{background:"#1e293b",borderRadius:18,padding:"18px 22px",border:"1px solid #334155",display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search student…" style={{...INP,flex:2,minWidth:180}}/>
        <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)} style={{...INP,flex:"0 0 160px"}}/>
        <select value={courseFilter} onChange={e=>setCourseFilter(e.target.value)} style={{...INP,flex:"0 0 200px",cursor:"pointer"}}>
          <option value="ALL">All Courses</option>
          {courses.map(c=><option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
        </select>
        <div style={{display:"flex",alignItems:"center",gap:10,marginLeft:"auto"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:polling?"#22c55e":"#ef4444",boxShadow:polling?"0 0 8px #22c55e":"none"}}/>
          <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>{polling?`Live · ${lastPoll||"…"}`:"Paused"}</span>
          <button onClick={()=>setPolling(p=>!p)} style={{background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:"5px 12px",color:"#94a3b8",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>
            {polling?"Pause":"Resume"}
          </button>
          <button onClick={fetchData} style={{background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:"5px 12px",color:"#94a3b8",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>⟳</button>
        </div>
      </div>

      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <Stat label="Students" value={filteredStudents.length} icon="👥" accent="#3b82f6"/>
        <Stat label="Present"  value={numPresent}              icon="✅" accent="#22c55e"/>
        <Stat label="Excused"  value={numExcused}              icon="📋" accent="#f59e0b"/>
        <Stat label="Absent"   value={numAbsent}               icon="❌" accent="#ef4444"/>
        <Stat label="Rate"     value={`${rate}%`}              icon="📊" accent="#8b5cf6"/>
      </div>

      <div style={{background:"#1e293b",borderRadius:18,border:"1px solid #334155",overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
            <thead>
              <tr style={{background:"#0f172a",borderBottom:"1px solid #334155"}}>
                <th style={TH}>Student</th>
                <th style={TH}>ID</th>
                <th style={TH}>Dept</th>
                <th style={TH}>Status</th>
                <th style={TH}>Time</th>
                <th style={TH}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s,i)=>{
                const rec    = attendance.find(r=>r.student_id===s.id);
                const report = reports.find(r=>r.student_id===s.id&&r.date===dateFilter);
                const status = rec?"present":report?"excused":"absent";
                return(
                  <tr key={s.id} style={{borderBottom:"1px solid #1a2942",background:i%2===0?"#1e293b":"#182132"}}>
                    <td style={TD}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <Avatar initials={s.name.split(" ").map(w=>w[0]).join("").slice(0,2)} idx={i} size={32}/>
                        <span style={{fontWeight:600,color:"#e2e8f0",fontSize:14}}>{s.name}</span>
                      </div>
                    </td>
                    <td style={{...TD,fontFamily:"monospace",fontSize:12,color:"#64748b"}}>{s.id}</td>
                    <td style={TD}><Badge color="#8b5cf6">{s.dept}</Badge></td>
                    <td style={TD}>
                      {status==="present"&&<Badge color="#22c55e">✅ Present</Badge>}
                      {status==="excused"&&<Badge color="#f59e0b">📋 Excused</Badge>}
                      {status==="absent" &&<Badge color="#ef4444">❌ Absent</Badge>}
                    </td>
                    <td style={{...TD,fontSize:13,color:"#94a3b8"}}>{rec?.time||"—"}</td>
                    <td style={TD}>
                      {report
                        ?<div style={{fontSize:12,color:"#94a3b8",maxWidth:220}}>
                           <span style={{color:"#f59e0b",fontWeight:700}}>[{report.reason}]</span>{" "}
                           {report.details?.slice(0,55)}{report.details?.length>55?"…":""}
                           {report.file_path&&<span style={{marginLeft:4,color:"#3b82f6"}}>📎</span>}
                         </div>
                        :<span style={{color:"#334155",fontSize:12}}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredStudents.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#475569",fontSize:14}}>No students found</div>}
      </div>

      {reports.length>0&&(
        <div style={{background:"#1e293b",borderRadius:18,padding:22,border:"1px solid #334155"}}>
          <div style={{fontSize:11,color:"#64748b",fontWeight:700,letterSpacing:".8px",textTransform:"uppercase",marginBottom:16}}>📋 Absence Reports</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {reports.map((r,i)=>(
              <div key={r.id} style={{display:"flex",gap:14,alignItems:"flex-start",background:"#0f172a",borderRadius:14,padding:"14px 18px",border:"1px solid #1e3a5f"}}>
                <Avatar initials={r.name.split(" ").map(w=>w[0]).join("").slice(0,2)} idx={i} size={36}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:4,alignItems:"center"}}>
                    <span style={{fontWeight:700,color:"#e2e8f0",fontSize:14}}>{r.name}</span>
                    <Badge color="#8b5cf6">{r.course_id}</Badge>
                    <Badge color="#f59e0b">{r.reason}</Badge>
                    {r.file_path&&<Badge color="#3b82f6">📎 Doc</Badge>}
                    <Badge color={r.status==="approved"?"#22c55e":r.status==="rejected"?"#ef4444":"#94a3b8"}>{r.status}</Badge>
                  </div>
                  <div style={{fontSize:13,color:"#94a3b8"}}>{r.details}</div>
                  <div style={{fontSize:11,color:"#475569",marginTop:5}}>{r.date} · {r.submitted_at}</div>
                </div>
                {r.status==="pending"&&(
                  <div style={{display:"flex",gap:8,flexShrink:0}}>
                    <button onClick={()=>handleAction(r.id,"approved",r.name)} style={{background:"#22c55e22",color:"#22c55e",border:"1px solid #22c55e44",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>Approve</button>
                    <button onClick={()=>handleAction(r.id,"rejected",r.name)} style={{background:"#ef444422",color:"#ef4444",border:"1px solid #ef444444",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Outfit',sans-serif"}}>Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  STUDENT PORTAL
// ══════════════════════════════════════════════
function StudentPortal({ courses, toast, connected }) {
  const [student,   setStudent]   = useState(null);
  const [sid,       setSid]       = useState("");
  const [pw,        setPw]        = useState("");
  const [loginErr,  setLoginErr]  = useState("");
  const [loginLoad, setLoginLoad] = useState(false);
  const [myReports, setMyReports] = useState([]);
  const [step,      setStep]      = useState("list");
  const [submitting,setSubmitting]= useState(false);
  const [form,      setForm]      = useState({course:"CS301",date:TODAY,reason:"Medical",details:"",file:null});

  const loadMyReports = useCallback(async()=>{
    if(!student) return;
    const {data}=await apiFetch("/absence-reports");
    if(data) setMyReports(data.filter(r=>r.student_id===student.id));
  },[student]);

  useEffect(()=>{loadMyReports();},[loadMyReports]);

  const doLogin = async()=>{
    setLoginLoad(true); setLoginErr("");
    const {data,error}=await apiPost("/auth/login",{student_id:sid,password:pw});
    if(error){setLoginErr(error);setLoginLoad(false);return;}
    setStudent(data.student); setLoginLoad(false);
  };

  const doSubmit = async()=>{
    if(!form.details.trim()){toast.add("Please describe the reason.","error");return;}
    setSubmitting(true);
    const fd=new FormData();
    fd.append("student_id",student.id);
    fd.append("course_id",form.course);
    fd.append("date",form.date);
    fd.append("reason",form.reason);
    fd.append("details",form.details);
    if(form.file) fd.append("file",form.file);
    const {error}=await apiUpload("/absence-reports",fd);
    if(error){toast.add(error,"error");setSubmitting(false);return;}
    toast.add("Absence report submitted! ✅");
    setStep("list");
    setForm({course:"CS301",date:TODAY,reason:"Medical",details:"",file:null});
    loadMyReports(); setSubmitting(false);
  };

  if(!student) return(
    <div style={{maxWidth:420,margin:"0 auto"}}>
      <ConnectionBanner ok={connected}/>
      <div style={{background:"#1e293b",borderRadius:22,padding:36,border:"1px solid #334155",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>🎓</div>
        <div style={{fontSize:22,fontWeight:800,color:"#f8fafc",marginBottom:4}}>Student Portal</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:28}}>Sign in to report your absence</div>
        <div style={{display:"flex",flexDirection:"column",gap:14,textAlign:"left"}}>
          <div>
            <label style={LBL}>Student ID</label>
            {/* ← የኔ Student ID እዚህ ይጻፉ */}
            <input value={sid} onChange={e=>setSid(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&doLogin()}
              placeholder="Enter your Student ID…" style={INP}/>
          </div>
          <div>
            <label style={LBL}>Password</label>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&doLogin()}
              placeholder="Password" style={INP}/>
          </div>
          {loginErr&&<div style={{color:"#ef4444",fontSize:13,fontWeight:600}}>{loginErr}</div>}
          <button onClick={doLogin} disabled={loginLoad||!sid.trim()||!pw.trim()}
            style={{...BTN,marginTop:6,opacity:loginLoad?0.6:1}}>
            {loginLoad?"Signing in…":"Sign In →"}
          </button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{maxWidth:700,margin:"0 auto",display:"flex",flexDirection:"column",gap:18}}>
      <ConnectionBanner ok={connected}/>
      <div style={{background:"#1e293b",borderRadius:18,padding:"16px 22px",border:"1px solid #334155",display:"flex",alignItems:"center",gap:14}}>
        <Avatar initials={student.name.split(" ").map(w=>w[0]).join("").slice(0,2)} idx={0} size={46}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,color:"#f8fafc",fontSize:17}}>{student.name}</div>
          <div style={{fontSize:12,color:"#64748b"}}>{student.id} · {student.dept} · Year {student.year}</div>
        </div>
        <button onClick={()=>setStudent(null)} style={{background:"#0f172a",border:"1px solid #334155",borderRadius:10,padding:"8px 16px",color:"#94a3b8",fontFamily:"'Outfit',sans-serif",fontSize:13,cursor:"pointer"}}>Sign Out</button>
      </div>

      {step==="list"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:18,fontWeight:800,color:"#f8fafc"}}>My Absence Reports <span style={{fontSize:13,color:"#64748b",fontWeight:500}}>({myReports.length})</span></div>
            <button onClick={()=>setStep("form")} style={BTN}>+ Report Absence</button>
          </div>
          {myReports.length===0
            ?<div style={{background:"#1e293b",borderRadius:18,padding:"50px 0",textAlign:"center",border:"1px solid #334155",color:"#475569"}}>
               <div style={{fontSize:40,marginBottom:10}}>📭</div>
               <div style={{fontSize:14,fontWeight:600,color:"#64748b"}}>No reports yet</div>
             </div>
            :myReports.map((r,i)=>(
              <div key={r.id} style={{background:"#1e293b",borderRadius:16,padding:"18px 22px",border:"1px solid #334155",display:"flex",gap:14}}>
                <div style={{fontSize:28}}>{r.reason==="Medical"?"🏥":r.reason==="Family Emergency"?"👨‍👩‍👧":"✈️"}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6,alignItems:"center"}}>
                    <Badge color="#8b5cf6">{r.course_id}</Badge>
                    <Badge color="#f59e0b">{r.reason}</Badge>
                    {r.file_path&&<Badge color="#3b82f6">📎</Badge>}
                    <Badge color={r.status==="approved"?"#22c55e":r.status==="rejected"?"#ef4444":"#94a3b8"}>{r.status}</Badge>
                  </div>
                  <div style={{fontSize:13,color:"#94a3b8"}}>{r.details}</div>
                  <div style={{fontSize:11,color:"#475569",marginTop:5}}>{r.date} · {r.submitted_at}</div>
                </div>
              </div>
            ))
          }
        </>
      )}

      {step==="form"&&(
        <div style={{background:"#1e293b",borderRadius:18,padding:28,border:"1px solid #334155"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#f8fafc",marginBottom:4}}>Report an Absence</div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:22}}>Fill in the details below.</div>
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:160}}>
                <label style={LBL}>Course</label>
                <select value={form.course} onChange={e=>setForm(f=>({...f,course:e.target.value}))} style={{...INP,cursor:"pointer"}}>
                  {courses.map(c=><option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              </div>
              <div style={{flex:1,minWidth:150}}>
                <label style={LBL}>Date</label>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={INP}/>
              </div>
            </div>
            <div>
              <label style={LBL}>Reason</label>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {["Medical","Family Emergency","Travel","Other"].map(r=>(
                  <button key={r} onClick={()=>setForm(f=>({...f,reason:r}))} style={{
                    border:form.reason===r?"none":"1px solid #334155",cursor:"pointer",padding:"10px 18px",borderRadius:12,
                    fontFamily:"'Outfit',sans-serif",fontSize:13,fontWeight:700,
                    background:form.reason===r?"#2563eb":"#0f172a",
                    color:form.reason===r?"#fff":"#94a3b8",
                    boxShadow:form.reason===r?"0 4px 18px #2563eb40":"none"
                  }}>{r==="Medical"?"🏥":r==="Family Emergency"?"👨‍👩‍👧":r==="Travel"?"✈️":"📝"} {r}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={LBL}>Details</label>
              <textarea value={form.details} onChange={e=>setForm(f=>({...f,details:e.target.value}))}
                placeholder="Describe the reason in detail…"
                rows={4} style={{...INP,resize:"vertical",lineHeight:1.6}}/>
            </div>
            <div>
              <label style={LBL}>Supporting Document (Optional)</label>
              <div style={{background:"#0f172a",border:"2px dashed #334155",borderRadius:14,padding:20,textAlign:"center",cursor:"pointer",position:"relative"}}>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={e=>setForm(f=>({...f,file:e.target.files[0]}))}
                  style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%"}}/>
                {form.file
                  ?<div style={{color:"#22c55e",fontWeight:600}}>📎 {form.file.name}</div>
                  :<><div style={{fontSize:28,marginBottom:6}}>📁</div><div style={{fontSize:13,color:"#64748b"}}>Upload medical certificate, leave letter…</div></>
                }
              </div>
            </div>
            <div style={{display:"flex",gap:12,justifyContent:"flex-end"}}>
              <button onClick={()=>setStep("list")} style={{background:"#0f172a",border:"1px solid #334155",borderRadius:12,padding:"12px 22px",color:"#94a3b8",fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={doSubmit} disabled={submitting} style={{...BTN,opacity:submitting?0.6:1}}>
                {submitting?"Submitting…":"Submit Report →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════
export default function App() {
  const [view,      setView]      = useState("scanner");
  const [students,  setStudents]  = useState([]);
  const [courses,   setCourses]   = useState([]);
  const [connected, setConnected] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const toast = useToast();

  useEffect(()=>{
    (async()=>{
      const {data:health}=await apiFetch("/health");
      setConnected(!!health);
      if(!health){setLoading(false);return;}
      const [sRes,cRes]=await Promise.all([apiFetch("/students"),apiFetch("/courses")]);
      if(sRes.data) setStudents(sRes.data);
      if(cRes.data) setCourses(cRes.data);
      setLoading(false);
    })();
  },[]);

  const VIEWS=[
    {id:"scanner",label:"QR Scanner",     icon:"📷"},
    {id:"admin",  label:"Instructor Dashboard",icon:"📊"},
    {id:"student",label:"Student Portal", icon:"🎓"},
  ];

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Outfit',sans-serif;background:#0f172a;color:#f8fafc;min-height:100vh}
        @keyframes fadeUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes toastIn{from{transform:translateX(50px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#0f172a}
        ::-webkit-scrollbar-thumb{background:#334155;border-radius:99px}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1)opacity(.4);cursor:pointer}
        select option{background:#1e293b}
      `}</style>

      <Toasts list={toast.list} remove={toast.remove}/>

      {/* Header */}
      <div style={{background:"#0a1120",borderBottom:"1px solid #1e293b",padding:"0 28px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",height:62,display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#2563eb,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🎓</div>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:"#f8fafc"}}>UniAttend</div>
            <div style={{fontSize:10,color:"#475569"}}>Smart University Attendance System</div>
          </div>
          <div style={{marginLeft:"auto",fontSize:11,color:"#475569"}}>
            {new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{background:"#0a1120",borderBottom:"1px solid #1e293b",padding:"0 28px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",gap:4,padding:"10px 0"}}>
          {VIEWS.map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)} style={{
              border:"none",cursor:"pointer",padding:"10px 22px",borderRadius:12,
              fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:700,
              display:"flex",alignItems:"center",gap:8,
              background:view===v.id?"#1d4ed8":"transparent",
              color:view===v.id?"#fff":"#64748b",
              boxShadow:view===v.id?"0 4px 18px #1d4ed840":"none"
            }}>{v.icon} {v.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:1200,margin:"0 auto",padding:"26px 28px",animation:"fadeUp .3s ease"}}>
        {loading?<Spinner/>:(
          <>
            {view==="scanner"&&<ScannerView students={students} courses={courses} toast={toast} connected={connected}/>}
            {view==="admin"  &&<AdminView   students={students} courses={courses} toast={toast} connected={connected}/>}
            {view==="student"&&<StudentPortal courses={courses} toast={toast} connected={connected}/>}
          </>
        )}
      </div>
    </>
  );
}

