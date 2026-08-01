// ============================================================
// utils/modalRegistry.js
// ------------------------------------------------------------
// خیلی از پنجره‌های تودرتو (ویرایش/افزودن محصول، ویرایش/افزودن متریال،
// بولک متریال و…) استیت بازبودن‌شون رو محلی (داخل خودِ MaterialTab.jsx یا
// ProductTab.jsx) نگه می‌دارن، نه توی App.jsx. برای اینکه سوایپ بین
// تب‌ها بدونه "الان یه پنجره‌ی دیگه باز نیست" بدون نیاز به بالا-بردن
// (lift) همه‌ی اون استیت‌ها، هر مودالی که باز می‌شه فقط با یه هوک
// (useRegisterOpenModal) خودش رو توی این رجیستری ثبت می‌کنه.
// ============================================================
import { createContext, useContext, useEffect, useRef, useState } from "react";

const RegisterContext = createContext(null); // تابع ثبت (write)
const CountContext = createContext(0);       // تعداد فعلی (read)

export function ModalRegistryProvider({ children }) {
  const countRef = useRef(0);
  const [count, setCount] = useState(0);

  const register = useRef(() => {
    countRef.current += 1;
    setCount(countRef.current);
    return () => {
      countRef.current = Math.max(0, countRef.current - 1);
      setCount(countRef.current);
    };
  }).current;

  return (
    <RegisterContext.Provider value={register}>
      <CountContext.Provider value={count}>{children}</CountContext.Provider>
    </RegisterContext.Provider>
  );
}

// هوکی که هر مودال، هروقت باز (mounted) بود، صداش می‌زنه
export function useRegisterOpenModal(isOpen = true) {
  const register = useContext(RegisterContext);
  useEffect(() => {
    if (!isOpen || !register) return undefined;
    const unregister = register();
    return unregister;
  }, [isOpen, register]);
}

// هوکی که مصرف‌کننده‌ها (مثل سوایپ/دکمه‌ی اسکرول‌تاپ) باهاش می‌فهمن الان
// حداقل یه پنجره‌ی تودرتو باز هست یا نه
export function useNestedModalCount() {
  return useContext(CountContext);
}
