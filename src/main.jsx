import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/global.css";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { PendingChangesProvider } from "./contexts/PendingChangesContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { ModalRegistryProvider } from "./utils/modalRegistry";
import { Capacitor } from "@capacitor/core";

// قفل زوم فونت سیستم — فقط اگر پلاگین موجود باشد (وگرنه استارت را خراب نکند)
if (Capacitor.isNativePlatform()) {
  import("@capacitor/text-zoom")
    .then(({ TextZoom }) => TextZoom.set({ value: 1.0 }))
    .catch(() => {});
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("App crash:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" style={{ padding: 24, color: "#f5f0eb", background: "#121214", minHeight: "100vh", fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#e08a8a" }}>خطا در اجرای اپ</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#ccc" }}>{String(this.state.error?.message || this.state.error)}</pre>
          <p style={{ fontSize: 12, color: "#888" }}>این متن را برای پشتیبانی بفرستید.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <PendingChangesProvider>
          <ToastProvider>
            <ModalRegistryProvider>
              <App />
            </ModalRegistryProvider>
          </ToastProvider>
        </PendingChangesProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);