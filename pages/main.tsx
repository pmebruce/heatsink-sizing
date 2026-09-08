import { createRoot } from "react-dom/client";
import HeatsinkApp from "@/app/heatsink-app";
import "../app/globals.css";
createRoot(document.getElementById("root")!).render(<HeatsinkApp/>);
