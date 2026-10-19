-- 앉을 가능성 등급을 없앤다(ADR 0006). 추천 기록의 grade 열을 지운다. 지난 기록의 등급 값도 함께 사라진다.
ALTER TABLE recommendations DROP COLUMN grade;
