import { createRoot } from "react-dom/client";
import DesignApp from "./design-app";
import "../app/globals.css";
import "./design.css";
createRoot(document.getElementById("root")!).render(<DesignApp/>);
