import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { getTypographySettings, applyTypography } from "./lib/appearance";

// Initialize saved typography and layout density settings
applyTypography(getTypographySettings());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="h-screen overflow-hidden">
      <App />
    </div>
  </React.StrictMode>
);
