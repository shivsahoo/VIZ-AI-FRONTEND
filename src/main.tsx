  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";
  import "./styles/tailwind-extras.css";
  import "./styles/apple-theme.css";
  import "./styles/apple-components.css";
  import "./styles/workspace.css";

  createRoot(document.getElementById("root")!).render(<App />);
