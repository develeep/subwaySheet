-- 설문 함수(functions/api/)의 D1 표. 컬럼 이름은 외부 계약이라 바꾸지 않는다(coding-convention "식별자").
-- 추천 기록: 결과 화면을 보여줄 때마다 하나. car_count·stop_count는 설문 응답의 칸 번호·정거장 수를 검증하려고 둔다.
CREATE TABLE recommendations (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  from_station TEXT NOT NULL,
  to_station TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('down', 'up')),
  depart_hour INTEGER NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday')),
  picks TEXT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('high', 'mid', 'low')),
  is_weak_gap INTEGER NOT NULL,
  has_missing_stations INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  car_count INTEGER NOT NULL,
  stop_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- 설문 응답: 추천 기록 하나에 하나뿐(PRIMARY KEY). 추천을 따랐으면 other_car는 NULL, 앉지 않았으면 stops_until_seated는 NULL.
CREATE TABLE survey_responses (
  recommendation_id TEXT PRIMARY KEY REFERENCES recommendations (id),
  is_followed INTEGER NOT NULL,
  other_car INTEGER,
  is_seated INTEGER NOT NULL,
  stops_until_seated INTEGER,
  created_at TEXT NOT NULL
);

-- 레이트 리밋: IP의 HMAC 해시와 1분 창마다 요청 수. 원 IP는 어디에도 두지 않는다.
CREATE TABLE rate_limits (
  ip_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, window_start)
);
