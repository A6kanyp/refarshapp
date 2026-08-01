import React, { createContext, useContext, useState } from "react";

const PendingChangesContext = createContext(null);

export function PendingChangesProvider({ children }) {
  const [pendingBulkChanges, setPendingBulkChanges] = useState(() => {
    try {
      const saved = sessionStorage.getItem("refarsh_pending_bulk");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  return (
    <PendingChangesContext.Provider value={{ pendingBulkChanges, setPendingBulkChanges }}>
      {children}
    </PendingChangesContext.Provider>
  );
}

export function usePendingChanges() {
  return useContext(PendingChangesContext);
}
