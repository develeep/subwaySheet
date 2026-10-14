import { describe, expect, it } from "vitest";
import { ROUTE_CONFIG } from "./routes";

describe("ROUTE_CONFIG", () => {
  it("2호선 본선은 시청(201)부터 충정로(243)까지 43개 역의 10칸 순환 노선이다", () => {
    const [main] = ROUTE_CONFIG.routes;
    expect(main).toMatchObject({ id: "2-main", carCount: 10, isLoop: true });
    expect(main?.codes).toHaveLength(43);
    expect([main?.codes[0], main?.codes.at(-1)]).toEqual(["201", "243"]);
  });
});
