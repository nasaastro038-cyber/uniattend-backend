"""
UniAttend — Camera QR/Barcode Scanner
Terminal ውስጥ ያስነሱ: python camera_scanner.py
"""
import cv2
from pyzbar import pyzbar
import requests
import datetime

BACKEND = "http://localhost:5000/api"

def checkin(student_id, course_id):
    try:
        res = requests.post(f"{BACKEND}/attendance/checkin", json={
            "student_id": student_id,
            "course_id":  course_id
        })
        data = res.json()
        if res.status_code == 200:
            return f"✅ {data['student']['name']} — {data['time']}"
        else:
            return f"⚠️  {data.get('error','Unknown error')}"
    except:
        return "❌ Backend ጋር መገናኘት አልተቻለም"

def run_scanner():
    # ትምህርቱን እዚህ ይቀይሩ
    COURSE = "CS301"

    cap = cv2.VideoCapture(0)  # 0 = laptop camera
    if not cap.isOpened():
        print("❌ Camera ሊከፈት አልቻለም!")
        return

    print(f"\n📷 Camera ተከፈተ — Course: {COURSE}")
    print("ተማሪው ID card ን camera ፊት ያቅርቡ")
    print("ለማቆም Q ይጫኑ\n")

    last_scanned = {}  # ደጋግሞ እንዳይቀመጥ

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # QR ወይም Barcode ፈልግ
        codes = pyzbar.decode(frame)

        for code in codes:
            student_id = code.data.decode("utf-8").strip()
            now = datetime.datetime.now().timestamp()

            # ተመሳሳይ ID በ5 ሴኮንድ ውስጥ ደጋግሞ እንዳይቀመጥ
            if student_id in last_scanned:
                if now - last_scanned[student_id] < 5:
                    continue

            last_scanned[student_id] = now
            result = checkin(student_id, COURSE)
            print(result)

            # Camera screen ላይ ውጤቱን አሳይ
            color = (0,255,0) if "✅" in result else (0,0,255)
            cv2.putText(frame, result, (10, 70),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

        # Course ስም ላይ አሳይ
        cv2.putText(frame, f"UniAttend | {COURSE} | Q=quit",
                   (10, 30), cv2.FONT_HERSHEY_SIMPLEX,
                   0.8, (255,255,0), 2)

        cv2.imshow("UniAttend Camera Scanner", frame)

        # Q ቁልፍ ሲጫን ያቁም
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("\n📷 Camera ተዘጋ")

if __name__ == "__main__":
    run_scanner()
