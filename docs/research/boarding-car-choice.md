# 승객이 탈 칸을 고르는 방식 조사 (2026-10-19)

질문: 역에서 탄 사람은 어느 칸에 서나? 탄 역 출입설비 쪽인가, 내릴 역 출구 쪽인가? 자리는 누가 먼저 앉나? 이 조사로 공식 6(ADR 0007, #23)을 정했다.

## 결론

- 탄 사람의 상당수(런던 추정 44~60%)가 **내릴 역의 출구 위치를 보고 칸을 고른다.** 그래서 탄 사람의 칸 분포를 탄 역 분포와 내릴 역 분포로 섞고, 섞는 몫 p_c를 0.44로 시작한다.
- 빈자리는 이미 타고 서 있던 사람이 먼저 앉고, 그다음 탄 사람이 남은 자리를 섞여서 나눠 앉는다는 문헌 모델이 있다. 지금 칸 점수의 경쟁 순서(ADR 0006)와 같아 그대로 둔다.
- 붐비는 칸을 피하는 효과는 좌석 점유 90%를 넘을 때만 약하게 나타났다. 반영하지 않는다.

## 확인한 것 (원문을 열어 본 것)

| 원본 | 확인한 내용 | 범위·한계 |
|---|---|---|
| Fang, Fujiyama, Wong 2019, *Transportation Planning and Technology* 42, 442-458. https://www.worldtransitresearch.info/research/7470 | 초록: 오전 첨두 승객의 **44%**가 "chose boarding cars based on the layouts of the stations where they alighted". 칸별 하중(loadweigh)으로 보정한 모델 | 런던 해머스미스앤시티선, 두 역, 오전 첨두. 직접 관측이 아닌 모델 추정치. 호수 (5)는 페이지에서 확인 못 함 |
| Fang, Wong, Fujiyama 2025, *Public Transport* 17(3), 835-870. https://www.worldtransitresearch.info/research/11602 | 초록: "on average, **60%** of the passengers lined up around the cars closest to the platform exits"(하차역 걷는 거리를 줄이려고) | 같은 노선. 2019년의 "하차역 배치로 칸을 고름"과 정의가 조금 다르다("출구에 가까운 칸 앞에 줄 섬") |
| Kim, Kwon, Wu, Sohn 2014, *Transportation Research Part A* 61, 249-258. https://ideas.repec.org/a/eee/transa/v61y2014icp249-258.html | 초록: 서울 7호선 오전 첨두 승강장 면접 조사, "the motivation to minimize the walking distance at destination stations turned out to be the most decisive"(nested logit) | 초록만 확인. 전문은 유료 |
| Khomchuk, Tuladhar, Sivananthan, arXiv 1808.06962. https://arxiv.org/abs/1808.06962 | 식 (8): 칸별 승차를 (1 − p_c) × 출발역 배치 분포 + p_c × 도착역 출구 분포로 섞는다. 시뮬레이션은 p_c = 0.3 | 프리프린트(Journal-ref 없음, 동료심사 안 거침) |
| Schmöcker 외 2011, *Transportation Research Part B* 45(2), 392-408. https://ideas.repec.org/a/eee/transb/v45y2011i2p392-408.html | 초록: 서 있던 승객이 내린 자리에 먼저 앉고 "before newly boarding passengers can fill any remaining seats", 탄 사람끼리는 섞인다(FIFO 아님) | 초록만 확인. 노선 배정 모델(칸 단위 아님) |
| Peftitsi, Jenelius, Cats 2020, *Transportmetrica A* 16(3), 529-549. https://worldtransitresearch.info/research/7774 (전문은 TU Delft 저장소 PDF) | 스톡홀름 지하철 3량 열차. 붐비는 칸 변수는 좌석 점유 90% 기준에서 설명력이 가장 높고, 그 아래에서는 효과가 없다. 효과도 작다(앞 칸 1명 증가 → 앞 칸 승차 몫 −0.08%) | 출입구 쏠림은 **작지 않다**: 출입구 유입 몫 1% 증가 → 가장 가까운 칸 승차 몫 약 0.2%, 시나리오 분석에서 출입구 재배치가 칸 선택에 가장 큰 효과. 하차 태그가 없어 내릴 역 행동은 분석 못 함 |

## 일부만 확인한 것

- Sumalee, Tan, Lam 2009, *Transportation Research Part B* 43(8-9), 895-912. https://ideas.repec.org/a/eee/transb/v43y2009i8-9p895-912.html — 초록에서 명시적 좌석 배분 모델(차내 승객 포함 앉을 확률)은 확인했다. 서 있던 사람 우선·균등 분배 문장은 초록에 없고, 전문(유료)은 보지 못했다.
- Jenelius 2020, *Transportation Research Part C* 117, 102647. https://www.worldtransitresearch.info/research/7934 — 좌석 배분 모델을 써서 앉을 확률·입석 시간을 예측한다. 다만 스톡홀름 **버스** 노선 사례이고 칸 단위가 아니다.

## 확인 못 한 것

- **Kim 2014의 53%**: 검증 과정에서 이 연구가 53%를 보고했다는 근거가 나왔지만, 초록에는 53이 없고 전문은 유료라 보지 못했다.
- **홍콩 MTR 칸 선택 연구(엠바고)**: 검색으로 찾지 못했다. PolyU 학위논문 저장소 링크는 내용과 엠바고 여부를 열어 보지 못했다.
- **실서비스 계산 방식**: 지하철 앱의 칸 혼잡 안내가 탄 사람의 칸을 어떻게 나누는지는 공개 자료로 확인하지 못했다.
- 서울 지하철에서의 p_c 값. 런던 값을 그대로 쓴다. 3단계 설문 보정은 이 조사 범위 밖이다.

## 이슈 원문과 다른 점

- 이슈 #23은 스톡홀름 연구를 "출입설비 쏠림은 실제로 있지만 효과가 작다"로 요약했지만, 원문은 출입구 재배치를 칸 선택에 가장 큰 효과로 본다. 지금 칸 점수는 이미 탄 사람을 출입설비 쪽으로 몰아 세우므로(p_c 아닌 몫) 결정은 바뀌지 않는다.
- 2025 논문 저자 순서는 Fang, Wong, Fujiyama다.
