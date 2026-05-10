from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3, os, datetime

app = Flask(__name__)
CORS(app)

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DB_PATH    = os.path.join(BASE_DIR, "attendance.db")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY, name TEXT, dept TEXT,
            year INTEGER, email TEXT, phone TEXT,
            password TEXT DEFAULT '1234'
        );
        CREATE TABLE IF NOT EXISTS courses (
            code TEXT PRIMARY KEY, name TEXT, dept TEXT, time TEXT
        );
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT, course_id TEXT,
            date TEXT, time TEXT, status TEXT DEFAULT 'present',
            UNIQUE(student_id, course_id, date)
        );
        CREATE TABLE IF NOT EXISTS absence_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT, course_id TEXT, date TEXT,
            reason TEXT, details TEXT, file_path TEXT,
            status TEXT DEFAULT 'pending', submitted_at TEXT
        );
        """)
        db.executemany(
            "INSERT OR IGNORE INTO students(id,name,dept,year,email,phone) VALUES(?,?,?,?,?,?)",
            [
                ("UGR/83787/18","Kurare Roba","Computer Science",3,"abebe@uni.edu.et","+251911001001"),
                ("UGR/23456/16","Sara Tesfaye","Electrical Eng.",2,"sara@uni.edu.et","+251911001002"),
                ("UGR/34567/15","Yohannes Gebru","Computer Science",3,"yohannes@uni.edu.et","+251911001003"),
                ("UGR/45678/17","Helen Demse","Civil Eng.",1,"helen@uni.edu.et","+251911001004"),
                ("UGR/56789/16","Dawit Alemu","Electrical Eng.",2,"dawit@uni.edu.et","+251911001005"),
            ]
        )
        db.executemany(
            "INSERT OR IGNORE INTO courses(code,name,dept,time) VALUES(?,?,?,?)",
            [
                ("CS301","Data Structures","Computer Science","08:00-09:30"),
                ("CS302","Algorithms","Computer Science","10:00-11:30"),
                ("EE201","Circuit Theory","Electrical Eng.","09:00-10:30"),
                ("CV101","Engineering Drawing","Civil Eng.","11:00-12:30"),
            ]
        )
        db.commit()

def do_checkin(student_id, course_id):
    now  = datetime.datetime.now()
    date = now.strftime("%Y-%m-%d")
    time = now.strftime("%H:%M")
    try:
        with get_db() as db:
            student = db.execute("SELECT * FROM students WHERE id=?",(student_id,)).fetchone()
            if not student:
                return {"ok":False,"msg":"Student not found"}
            db.execute(
                "INSERT INTO attendance(student_id,course_id,date,time,status) VALUES(?,?,?,?,?)",
                (student_id,course_id,date,time,"present")
            )
            db.commit()
        return {"ok":True,"name":student["name"],"time":time}
    except sqlite3.IntegrityError:
        return {"ok":False,"msg":"Already checked in"}

@app.route("/api/students")
def get_students():
    with get_db() as db:
        rows = db.execute("SELECT id,name,dept,year,email,phone FROM students").fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/courses")
def get_courses():
    with get_db() as db:
        rows = db.execute("SELECT * FROM courses").fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/attendance/checkin", methods=["POST"])
def checkin():
    data = request.get_json(force=True)
    sid  = data.get("student_id","").strip()
    cid  = data.get("course_id","").strip()
    result = do_checkin(sid, cid)
    if not result["ok"]:
        return jsonify({"error":result["msg"]}),409
    return jsonify({"status":"success","student":{"name":result["name"]},"time":result["time"]})

@app.route("/api/attendance")
def get_attendance():
    date   = request.args.get("date", datetime.date.today().isoformat())
    course = request.args.get("course_id")
    sql    = "SELECT a.*,s.name,s.dept FROM attendance a JOIN students s ON a.student_id=s.id WHERE a.date=?"
    params = [date]
    if course:
        sql += " AND a.course_id=?"; params.append(course)
    with get_db() as db:
        rows = db.execute(sql,params).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/absence-reports", methods=["POST"])
def submit_absence():
    sid     = request.form.get("student_id","").strip()
    cid     = request.form.get("course_id","").strip()
    date    = request.form.get("date","").strip()
    reason  = request.form.get("reason","").strip()
    details = request.form.get("details","").strip()
    file_path = None
    uploaded  = request.files.get("file")
    if uploaded and uploaded.filename:
        ext  = uploaded.filename.rsplit(".",1)[-1].lower()
        safe = f"{sid.replace('/','_')}_{cid}_{date}.{ext}"
        uploaded.save(os.path.join(UPLOAD_DIR,safe))
        file_path = safe
    submitted_at = datetime.datetime.now().strftime("%H:%M")
    with get_db() as db:
        db.execute(
            "INSERT INTO absence_reports(student_id,course_id,date,reason,details,file_path,status,submitted_at) VALUES(?,?,?,?,?,?,?,?)",
            (sid,cid,date,reason,details,file_path,"pending",submitted_at)
        )
        db.commit()
    return jsonify({"status":"submitted"}),201

@app.route("/api/absence-reports")
def get_absence_reports():
    with get_db() as db:
        rows = db.execute("""
            SELECT ar.*,s.name FROM absence_reports ar
            JOIN students s ON ar.student_id=s.id ORDER BY ar.id DESC
        """).fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/absence-reports/<int:rid>", methods=["PATCH"])
def update_report(rid):
    status = request.get_json(force=True).get("status")
    with get_db() as db:
        db.execute("UPDATE absence_reports SET status=? WHERE id=?",(status,rid))
        db.commit()
    return jsonify({"id":rid,"status":status})

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    sid  = data.get("student_id","").strip()
    pw   = data.get("password","").strip()
    with get_db() as db:
        row = db.execute("SELECT * FROM students WHERE id=?",(sid,)).fetchone()
    if not row:
        return jsonify({"error":"Student ID not found"}),401
    if row["password"] != pw:
        return jsonify({"error":"Incorrect password"}),401
    s = dict(row); s.pop("password")
    return jsonify({"status":"ok","student":s})

@app.route("/api/health")
def health():
    return jsonify({"status":"running"})

if __name__ == "__main__":
    init_db()
    print("\n🎓 UniAttend Backend → http://localhost:5000\n")
    app.run(debug=True, port=5000)
