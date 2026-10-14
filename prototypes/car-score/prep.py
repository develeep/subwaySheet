# PROTOTYPE: 버리는 코드. raw/ 공공데이터를 2호선 본선용 data.js 하나로 줄인다.
# 실행: python3 prototypes/car-score/prep.py → car-score-prototype.html
import csv, json, re
from collections import defaultdict
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "raw"

# 2024 공휴일(대체·임시 포함). 일요일·공휴일 유형으로 묶는다.
HOLIDAYS_2024 = {
    "2024-01-01", "2024-02-09", "2024-02-10", "2024-02-11", "2024-02-12",
    "2024-03-01", "2024-04-10", "2024-05-05", "2024-05-06", "2024-05-15",
    "2024-06-06", "2024-08-15", "2024-09-16", "2024-09-17", "2024-09-18",
    "2024-10-01", "2024-10-03", "2024-10-09", "2024-12-25",
}


def day_type(ymd):
    if ymd in HOLIDAYS_2024:
        return "sun"
    wd = date.fromisoformat(ymd).weekday()
    return "sat" if wd == 5 else "sun" if wd == 6 else "wkd"


def base_name(name):
    # "강변(동서울터미널)" -> "강변". 데이터마다 부기명 표기가 달라서 괄호 앞만 쓴다.
    return re.sub(r"\(.*\)", "", name).strip()


# 승하차: 06시이전 + 06~24 + 24시이후 = 20칸. 앱 시간대 index 0 = "06시 이전"
ride_sum = defaultdict(lambda: [0] * 20)
days = defaultdict(set)
lines_at = defaultdict(set)
with open(RAW / "ridership-2024.csv", encoding="utf-8") as f:
    r = csv.reader(f)
    next(r)
    for row in r:
        if len(row) < 26:
            continue
        _, ymd, line, no, name, kind = row[:6]
        lines_at[base_name(name)].add(line)
        if line != "2호선" or not (201 <= int(no) <= 243):
            continue
        dt = day_type(ymd)
        days[dt].add(ymd)
        acc = ride_sum[(int(no), dt, "on" if kind == "승차" else "off")]
        for i, v in enumerate(row[6:26]):
            acc[i] += int(v or 0)

stations = {}
with open(RAW / "ridership-2024.csv", encoding="utf-8") as f:
    for row in csv.reader(f):
        if len(row) > 5 and row[2] == "2호선" and row[3].isdigit() and 201 <= int(row[3]) <= 243:
            stations[int(row[3])] = base_name(row[4])

ride = {}
for (no, dt, k), acc in ride_sum.items():
    ride.setdefault(no, {}).setdefault(dt, {})[k] = [round(v / len(days[dt])) for v in acc]

# 혼잡도: 30분 단위 → 앱 시간대(1시간)로 평균. 2호선은 내선/외선.
CONG_DT = {"평일": "wkd", "토요일": "sat", "일요일": "sun"}
cong = {}
with open(RAW / "congestion-202606.csv", encoding="utf-8") as f:
    r = csv.reader(f)
    header = next(r)
    for row in r:
        if row[1] != "2호선" or not row[2].isdigit() or not (201 <= int(row[2]) <= 243):
            continue
        vals = [float(v) if v.strip() else 0.0 for v in row[5:]]
        # 열: 5:30, 6:00, 6:30 ... 00:30. 시간대 i(0=06시 이전, 1=06-07 ... 18=23-24, 19=24시 이후)
        hourly = [vals[0]]
        for h in range(18):
            hourly.append(round((vals[1 + 2 * h] + vals[2 + 2 * h]) / 2, 1))
        hourly.append(round(sum(vals[37:]) / max(1, len(vals[37:])), 1))
        cong.setdefault(int(row[2]), {}).setdefault(CONG_DT[row[0]], {})["in" if row[4] == "내선" else "out"] = hourly

# 환승인원: 역 단위 일평균. 2호선에서 내려 갈아타는 몫은 앱에서 노선 수로 나눠 추정한다.
xfer = {}
with open(RAW / "transfer-202606.csv", encoding="utf-8") as f:
    r = csv.reader(f)
    next(r)
    for _, name, wkd, sat, sun in r:
        xfer[base_name(name)] = {"wkd": int(wkd), "sat": int(sat), "sun": int(sun)}

fst_path = RAW / "fst-exit.json"
fst = json.loads(fst_path.read_text()) if fst_path.exists() else None
# 2호선 본선 빠른하차를 역번호·방향별 출입설비 목록으로. 하행 = 역번호가 커지는 쪽(시청→을지로입구).
fst_by_no = {}
name_to_no = {v: k for k, v in stations.items()}
for x in fst or []:
    no = name_to_no.get(base_name(x["stnNm"]))
    if x["lineNm"] != "2호선" or no is None or not re.fullmatch(r"\d+-\d+", x["qckgffVhclDoorNo"]):
        continue
    car, door = map(int, x["qckgffVhclDoorNo"].split("-"))
    d = "down" if x["upbdnbSe"] == "하행" else "up"
    fst_by_no.setdefault(no, {"down": [], "up": []})[d].append({
        "car": car, "door": door, "kind": x["plfmCmgFac"], "toward": x["drtnInfo"], "note": x.get("facPstnNm"),
    })
fst_line2 = fst_by_no or None

out_stations = []
for no in sorted(stations):
    name = stations[no]
    out_stations.append({
        "no": no,
        "name": name,
        "seoulMetroLines": len(lines_at[name]),
        "transferPerDay": xfer.get(name),
        "ride": ride[no],
        "cong": cong.get(no),
        "fac": (fst_line2 or {}).get(no),
    })


data = {
    "period": f"{min(days['wkd'])} ~ {max(days['wkd'])}",
    "dayCounts": {k: len(v) for k, v in days.items()},
    "stations": out_stations,
}
# 이메일로 보내도 열리게 데이터를 HTML 안에 넣는다.
template = (HERE / "template.html").read_text(encoding="utf-8")
html = template.replace("/*DATA*/null", json.dumps(data, ensure_ascii=False))
(HERE / "car-score-prototype.html").write_text(html, encoding="utf-8")
print(f"역 {len(out_stations)}개, 요일유형 일수 {data['dayCounts']}, 빠른하차 {len(fst_line2) if fst_line2 else '없음'}")
