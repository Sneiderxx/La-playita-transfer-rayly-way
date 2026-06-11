import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/auth";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// Configurar URL del API
setBaseUrl("https://la-playita-transfer-rayly-way-production.up.railway.app");

// Force dark mode
document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryClientProvider>
);