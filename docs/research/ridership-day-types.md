# 승하차 데이터의 요일 구분 조사 (2026-10-14)

질문: 주말·공휴일도 추천할 수 있나? 각 데이터가 평일/주말을 나눠 주나?

## 결론

시간대 × 역 × 날짜 데이터(OA-12921)가 있어 요일유형별로 나눌 수 있다. 단, 어느 승하차 데이터에도 상·하행 구분은 없어 방향 분할 추정은 그대로 필요하다. **PRD의 주 데이터인 CardSubwayTime(OA-12252)은 평일과 주말이 섞인 월 합계라, 평일만 지원하더라도 그대로 쓰면 주말 값이 섞인다.**

## 데이터별

| 데이터 | 단위 | 요일 구분 | 방향 | 갱신 |
|---|---|---|---|---|
| CardSubwayTime OA-12252 | 월 합계 × 1시간 × 역 | 없음(섞임) | 없음 | 매월 5일 |
| CardSubwayStatsNew OA-12914 | 일 × 역 (시간대 없음) | 날짜로 판정 | 없음 | 매일(3일 전 값) |
| 서울교통공사 역별 일별 시간대별 승하차 OA-12921 / data.go.kr 15048032 | 일 × 1시간 × 역 | 날짜로 판정 | 없음 | **연 1회** (최신 2025-12 기준, 다음 2026-11-03 예정) |
| 혼잡도 OA-12928 | 30분 × 역 × 상하선 | 평일/토/일 (공휴일 처리 미확인) | 있음 | 분기 |
| 환승인원 data.go.kr 15062858 | 일평균 × 환승역 | 평일/토/일 | 없음 | 분기 |

- OA-12252 필드: `USE_MM`, `SBWY_ROUT_LN_NM`, `STTN`, `HR_4_GET_ON_NOPE`/`HR_4_GET_OFF_NOPE` … `HR_3_*`, `JOB_YMD`. 요청 인자는 `USE_MM`뿐. https://data.seoul.go.kr/dataList/openApiView.do?infId=OA-12252&srvType=A
- OA-12914 필드: `USE_YMD`, `SBWY_ROUT_LN_NM`, `SBWY_STNS_NM`, `GTON_TNOPE`, `GTOFF_TNOPE`, `REG_YMD`. https://data.seoul.go.kr/dataList/openApiView.do?infId=OA-12914&srvType=A
- OA-12921 필드: `MVMN_YMD`, `LINE`, `STTN_NO`, `STTN`, `GTNF_SE`(승하차구분), `HR06_BFR`, `HR06`~`HR23`, 24시 이후. 서울교통공사 관할 구간만(1호선은 서울역~청량리). https://data.seoul.go.kr/dataList/OA-12921/S/1/datasetView.do , https://www.data.go.kr/data/15048032/fileData.do
- 혼잡도: "요일구분(평일, 토요일, 일요일), 호선, 역번호, 역명, 상하선구분, 30분단위 별 혼잡도". https://data.seoul.go.kr/dataList/OA-12928/S/1/datasetView.do
- 환승인원: 연번, 출발역명, 평일, 토요일, 일요일(일평균). https://www.data.go.kr/data/15062858/fileData.do

## 열차 수 (미확인)

- 열차운행현황 OA-13318: `운행횟수_평일`, `운행횟수_휴일`, `운행시격_RH`, `운행시격_NH` (2024-03-31 기준). 실제 값과 토요일 포함 여부는 확인 못 함. https://data.seoul.go.kr/dataList/OA-13318/F/1/datasetView.do
- 시간표 OA-101 `SearchSTNTimeTableByIDService`: `WEEK_TAG`, `INOUT_TAG` 필수. 값 체계 미확인. https://data.seoul.go.kr/dataList/openApiView.do?infId=OA-101&srvType=A
- 혼잡도는 열차 한 대 기준 값이라 배차 차이가 이미 반영돼 있다.

## 미확인

- 혼잡도·환승인원에서 공휴일이 "일요일"에 들어가는지.
- 환승인원의 시간대 분포.
