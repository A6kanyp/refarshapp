import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type) => {
    if (typeof message === 'object' && message !== null) {
      setToast(message);
    } else {
      setToast({ text: message, type: type || 'info' });
    }
    // Set a timeout to clear the toast
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, []);

  const isError = toast && (
    toast.type === 'error' ||
    toast.type === 'no_change' ||
    (toast.text && (
      toast.text.toLowerCase().includes("خطا") ||
      toast.text.toLowerCase().includes("error") ||
      toast.text.toLowerCase().includes("failed") ||
      toast.text.toLowerCase().includes("خطایی")
    ))
  );

  const toastText = toast ? (typeof toast === 'object' ? toast.text : toast) : '';

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 40,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "10px 16px",
          borderRadius: 8,
          background: isError ? "#3a1d1d" : "#1d3a24",
          border: `1px solid ${isError ? "#8B1A1A" : "#2d5a38"}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)",
          minWidth: 250
        }}>
          {isError ? (
            <XCircle size={18} color="#e08a8a" style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={18} color="#5fd180" style={{ flexShrink: 0 }} />
          )}
          <span style={{ marginLeft: 8, marginRight: 8, fontSize: toast.fontSize || 12, color: isError ? "#e08a8a" : "#5fd180", fontWeight: 500, whiteSpace: "pre-line", lineHeight: 1.6 }}>
            {toastText}
          </span>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
