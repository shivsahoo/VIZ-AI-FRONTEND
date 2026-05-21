import { createRoot } from "react-dom/client";

import { EmbedApp } from "./EmbedApp";
import "./embed.css";

function boot() {
  const config = window.__VIZAI_EMBED__;
  if (!config) {
    document.body.innerHTML =
      '<div class="error-state" style="margin:40px auto;max-width:500px;">Embed configuration missing.</div>';
    return;
  }

  const rootEl = document.getElementById("embed-root");
  if (!rootEl) {
    return;
  }

  createRoot(rootEl).render(
    <EmbedApp
      tokenId={config.tokenId}
      apiBase={config.apiBase}
      dashboardTitle={config.dashboardTitle}
      charts={config.charts}
      initialAccessToken={config.accessToken}
      initialRefreshToken={config.refreshToken}
      initialExpiresIn={config.expiresIn}
    />,
  );
}

boot();
