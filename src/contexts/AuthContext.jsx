import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../lib/firebase.js";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (e) {
        console.warn("setPersistence failed:", e);
      }
      unsub = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          try {
            const idToken = await currentUser.getIdToken();
            setToken(idToken);
          } catch {
            setToken(null);
          }
        } else {
          setToken(null);
        }
        setLoading(false);
      });
    })();
    return () => unsub();
  }, []);

  const applyUser = async (currentUser) => {
    setUser(currentUser);
    if (currentUser) {
      try {
        const idToken = await currentUser.getIdToken(true);
        setToken(idToken);
      } catch {
        setToken(null);
      }
    } else {
      setToken(null);
    }
  };

  const login = async () => {
    try {
      // وب / AI Studio / لپ‌تاپ
      if (!Capacitor.isNativePlatform()) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const result = await signInWithPopup(auth, provider);
        await applyUser(result.user);
        return {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoUrl: result.user.photoURL,
        };
      }

      // نیتیو APK: پلاگین + همگام‌سازی دستی JS SDK
      const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result?.credential?.idToken;
      if (idToken) {
        const credential = GoogleAuthProvider.credential(
          idToken,
          result?.credential?.accessToken
        );
        const credResult = await signInWithCredential(auth, credential);
        await applyUser(credResult.user);
        return {
          uid: credResult.user.uid,
          email: credResult.user.email,
          displayName: credResult.user.displayName,
          photoUrl: credResult.user.photoURL,
        };
      }
      if (result?.user) {
        await applyUser(auth.currentUser);
        return result.user;
      }
      throw new Error("لاگین گوگل idToken برنگرداند");
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
          await FirebaseAuthentication.signOut();
        } catch (_) {}
      }
      await auth.signOut();
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  };

  const getToken = async () => {
    if (auth.currentUser) return await auth.currentUser.getIdToken(true);
    if (user) return await user.getIdToken(true);
    return null;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
