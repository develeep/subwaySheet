import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../design/tokens.css";
import "./styles/global.css";
import { SeatFinderPage } from "./pages/seat-finder-page";

const root = document.getElementById("root");
if (!root) throw new Error("#root가 없다");

createRoot(root).render(
  <StrictMode>
    <SeatFinderPage />
  </StrictMode>,
);
