import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import TitleBar from "./components/app/title-bar";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        <App />
      </div>
    </div>
  </React.StrictMode>
);
