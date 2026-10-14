import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../design/tokens.css";
import "./global.css";
import { SeatFinderScreen } from "./seat-finder/seat-finder-screen";

const root = document.getElementById("root");
if (!root) throw new Error("#root가 없다");

createRoot(root).render(
  <StrictMode>
    <SeatFinderScreen />
  </StrictMode>,
);
