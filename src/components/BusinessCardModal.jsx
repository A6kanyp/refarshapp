// ============================================================
// BusinessCardModal.jsx - Refarsh Clean (نسخه نهایی با دو بخش مجزا)
// ============================================================
import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Edit3, Save, Copy, Check, ChevronDown, ChevronUp, User, Users } from "lucide-react";
import { uid, emptyBusinessCard } from "../dataModels";
import { formatPhoneInput, parsePhoneInput } from "../utils/formatters";
import { useToast } from "../contexts/ToastContext.jsx";
import { compressImageFile } from "../utils/imageCompress";
import { saveImageToFolder, generateImageFilename, deleteImageFile, IMAGE_CATEGORIES, useResolvedImageSrc } from "../utils/imageStorage";
import { useRegisterOpenModal } from "../utils/modalRegistry";
import { useSwipeTabNav, useTabSlideClass } from "../utils/swipeTabs";

// ── CardImage ──
// بخش «بازطراحی ذخیره‌سازی عکس‌ها» (Wall 🟣): مشابه ProductImage توی ProductTab.jsx.
// عکس‌های کارت‌ویزیت/QR جدید فقط اسم فایل رو ذخیره می‌کنن (نه base64)؛ این
// کامپوننت async حلش می‌کنه، و برای داده‌های قدیمی (data URL مستقیم) هم سازگاره.
function CardImage({ filename, category, alt = "", style, onClick, referrerPolicy }) {
  const isLegacyInline = !!filename && (filename.startsWith("data:") || filename.startsWith("http") || filename.startsWith("/"));
  const resolvedSrc = useResolvedImageSrc(isLegacyInline ? null : filename, category);
  if (!filename) return null;
  const src = isLegacyInline ? filename : resolvedSrc;
  // resolvedSrc===null یعنی هنوز در حال resolve؛ undefined بعد از resolve = فایل نیست
  if (!isLegacyInline && resolvedSrc === undefined) {
    return <div style={{ ...style, background: "#161616" }} onClick={onClick} />;
  }
  if (!src) {
    // فایل در پوشه/IndexedDB پیدا نشد — همون علامت زرد ProductImage
    return (
      <div style={{ ...style, background: "#161616", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClick}>
        <span title="فایل عکس در پوشه پیدا نشد" style={{ position: "absolute", top: 4, left: 4, width: 16, height: 16, borderRadius: "50%", background: "#e0b93c", color: "#1a1a1a", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>!</span>
      </div>
    );
  }
  return <img src={src} alt={alt} style={style} onClick={onClick} referrerPolicy={referrerPolicy} />;
}

const T = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    zIndex: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    width: "95%",
    maxWidth: 500,
    maxHeight: "85vh",
    background: "#181818",
    borderRadius: 16,
    border: "1px solid #2a2a2a",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "14px 16px",
    borderBottom: "1px solid #2a2a2a",
    background: "#1a1a1a",
    flexShrink: 0,
  },
  body: {
    padding: "16px",
    overflowY: "auto",
    flex: 1,
  },
  card: {
    background: "#121212",
    borderRadius: 10,
    border: "1px solid #232323",
    padding: "14px 16px",
    marginBottom: 12,
  },
  input: {
    width: "100%",
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: "7px 10px",
    color: "#ddd",
    fontFamily: "inherit",
    fontSize: 11,
    outline: "none",
    boxSizing: "border-box",
  },
  chip: {
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    color: "#888",
    fontSize: 10,
    padding: "4px 9px",
    borderRadius: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  chipActive: {
    background: "#2a1414",
    border: "1px solid #8B1A1A",
    color: "#d88888",
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px 6px",
    display: "flex",
    alignItems: "center",
    color: "#888",
  },
};


// ── کارت نمایشی (با قابلیت باز/بستن) ──
function CardView({ card, title, icon, forceExpanded = false, isMine = false }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(forceExpanded || false);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);

  const copyText = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!card || !card.name) return null;

  const phones = Array.isArray(card.phones) ? card.phones : (card.phone ? [card.phone] : []);

  const fields = [
    { label: "آدرس", value: card.address, key: "address" },
    { label: "وب‌سایت", value: card.website, key: "website" },
    { label: "اینستاگرام", value: card.instagram, key: "instagram" },
    { label: "لینکدین", value: card.linkedin, key: "linkedin" },
    { label: "تلگرام", value: card.telegram, key: "telegram" },
    { label: "واتساپ", value: card.whatsapp, key: "whatsapp" },
    { label: "ایمیل", value: card.email, key: "email" },
    { label: "یادداشت", value: card.note, key: "note" },
  ];

  const nonEmptyFields = fields.filter((f) => f.value);

  return (
    <div style={T.card}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
          <span style={{ fontSize: 11, color: "#a89bd4", fontWeight: 700 }}>{title}</span>
        </div>
      )}
      
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: forceExpanded ? "default" : "pointer" }}
        onClick={() => !forceExpanded && setExpanded(!expanded)}
      >
        <div style={{ fontSize: 10.5, color: "#ddd" }}>
          <strong>{card.name}</strong>
          {phones.length > 0 && <span style={{ marginRight: 10, color: "#888", direction: "ltr", display: "inline-block" }}>{formatPhoneInput(phones[0])}</span>}
        </div>
        {!forceExpanded && (
          <div>
            {expanded ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
          </div>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e1e1e" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {phones.map((p, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#aaa", padding: "2px 0" }}>
                <span style={{ color: "#666", minWidth: 50, flexShrink: 0 }}>تلفن {phones.length > 1 ? idx + 1 : ""}:</span>
                <span style={{ flex: 1, direction: "ltr", textAlign: "right" }}>{formatPhoneInput(p)}</span>
                <button style={T.iconBtn} onClick={() => copyText(p)} title="کپی">
                  {copied ? <Check size={12} color="#5fd180" /> : <Copy size={12} color="#555" />}
                </button>
              </div>
            ))}
            {nonEmptyFields.map(({ label, value, key }) => {
              const isLink = key === "website" || key === "instagram" || key === "linkedin" || key === "telegram" || key === "whatsapp";
              let linkValue = value;
              if (key === "instagram") {
                 let username = value.replace(/^@/, '');
                 linkValue = `https://www.instagram.com/${username}`;
              } else if (key === "whatsapp") {
                 let phone = value.replace(/^0/, '');
                 linkValue = `https://wa.me/+98${phone}`;
              } else if (isLink) {
                 linkValue = value.startsWith("http") ? value : `https://${value}`;
              }
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#aaa", padding: "2px 0" }}>
                  <span style={{ color: "#666", minWidth: 50, flexShrink: 0 }}>{label}:</span>
                  <span style={{ flex: 1, wordBreak: "break-all" }}>
                    {isLink ? (
                      <a href={linkValue} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#7aa8d8", textDecoration: "none", direction: key === "whatsapp" ? "ltr" : undefined, unicodeBidi: key === "whatsapp" ? "plaintext" : undefined, display: key === "whatsapp" ? "inline-block" : undefined }}>
                        {key === "whatsapp" ? formatPhoneInput(value) : value}
                      </a>
                    ) : value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Archived images display */}
          {Array.isArray(card.images) && card.images.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1e1e1e" }}>
              <div style={{ fontSize: 9, color: "#555", marginBottom: 4 }}>تصاویر آرشیو شده ({card.images.length}):</div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                {card.images.map((img, idx) => (
                  <CardImage
                    key={idx}
                    filename={img}
                    category={IMAGE_CATEGORIES.CARD}
                    style={{
                      width: 60,
                      height: 60,
                      objectFit: "cover",
                      borderRadius: 6,
                      cursor: "pointer",
                      border: "1px solid #232323",
                      flexShrink: 0,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxImage({ filename: img, category: IMAGE_CATEGORIES.CARD });
                    }}
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
            </div>
          )}

          {/* QR Code display */}
          {card.qrCode && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e1e1e", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 9.5, color: "#888" }}>کد QR کارت ویزیت (برای بزرگ‌نمایی لمس کنید)</div>
              <div
                style={{ width: 110, height: 110, background: "#fff", padding: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); setLightboxImage({ filename: card.qrCode, category: isMine ? IMAGE_CATEGORIES.QR : IMAGE_CATEGORIES.CARD }); }}
              >
                <CardImage filename={card.qrCode} category={isMine ? IMAGE_CATEGORIES.QR : IMAGE_CATEGORIES.CARD} style={{ width: "100%", height: "100%", objectFit: "contain" }} referrerPolicy="no-referrer" alt="QR Code" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.95)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            e.stopPropagation();
            setLightboxImage(null);
          }}
        >
          <CardImage
            filename={lightboxImage.filename}
            category={lightboxImage.category}
            style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.8)" }}
            alt="Lightbox"
            referrerPolicy="no-referrer"
          />
          <button
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setLightboxImage(null);
            }}
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── کارت ویرایشی ──
function CardEditor({ card, onChange, onDelete, onSave, onCancel, isMine = false }) {
  const DEFAULT_MY_CARD_NAME = "استودیو فرش و دکور ریفرش";
  const phones = Array.isArray(card.phones) ? card.phones : (card.phone ? [card.phone] : [""]);
  const { showToast } = useToast();
  const [errors, setErrors] = useState({});

  const fields = [
    { key: "name", label: "نام (الزامی)", placeholder: "نام کامل" },
    { key: "address", label: "آدرس", placeholder: "آدرس کامل" },
    { key: "website", label: "وب‌سایت", placeholder: "https://..." },
    { key: "instagram", label: "اینستاگرام", placeholder: "@username" },
    { key: "linkedin", label: "لینکدین", placeholder: "linkedin.com/in/..." },
    { key: "telegram", label: "تلگرام", placeholder: "@username" },
    { key: "whatsapp", label: "واتساپ", placeholder: "۰۹۱۲..." },
    { key: "email", label: "ایمیل", placeholder: "example@domain.com" },
    { key: "note", label: "یادداشت", placeholder: "توضیحات" },
  ];

  const handlePhoneChange = (idx, value) => {
    const newPhones = [...phones];
    newPhones[idx] = formatPhoneInput(value);
    onChange(card.id, "phones", newPhones);
  };

  const addPhoneField = () => {
    onChange(card.id, "phones", [...phones, ""]);
  };

  const removePhoneField = (idx) => {
    const newPhones = phones.filter((_, i) => i !== idx);
    onChange(card.id, "phones", newPhones.length > 0 ? newPhones : [""]);
  };

  const handleFileChange = (e, targetKey) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach((file) => {
      if (targetKey === "qrCode") {
        // کد QR نباید فشرده/کوچک بشه، وگرنه ممکنه دیگه قابل اسکن نباشه.
        // طبق بازطراحی ذخیره‌سازی عکس‌ها (Wall 🟣): QR کارت خودم توی qr/،
        // QR کارت‌های همکار/تامین‌کننده توی cards/ ذخیره می‌شه؛ فقط اسم فایل
        // (نه خودِ عکس) توی رکورد کارت می‌مونه.
        const reader = new FileReader();
        reader.onload = () => {
          const category = isMine ? IMAGE_CATEGORIES.QR : IMAGE_CATEGORIES.CARD;
          saveImageToFolder(reader.result, category, generateImageFilename("qr", "png"))
            .then((filename) => onChange(card.id, "qrCode", filename))
            .catch((err) => console.error("QR save failed:", err));
        };
        reader.readAsDataURL(file);
        return;
      }
      // قبلاً عکس‌های کارت‌ویزیت خام (بدون فشرده‌سازی، گاهی چند مگابایت) ذخیره
      // می‌شدن که هم می‌تونست باعث کند شدن/کرش اپ توی لیست‌ها بشه، هم حجم
      // localStorage رو پر کنه. الان بعد از فشرده‌سازی توی پوشه‌ی محلی cards/
      // ذخیره می‌شه (فقط اسم فایل توی رکورد کارت می‌مونه)
      compressImageFile(file)
        .then((dataUrl) => saveImageToFolder(dataUrl, IMAGE_CATEGORIES.CARD, generateImageFilename("card")))
        .then((filename) => {
          if (targetKey === "images") {
            const currentImages = Array.isArray(card.images) ? card.images : [];
            onChange(card.id, "images", [...currentImages, filename]);
          }
        })
        .catch((err) => console.error("Business card image compress failed:", err));
    });
  };

  const handleValidateAndSave = () => {
    const errs = {};
    if (!card.name || !card.name.trim()) {
      errs.name = true;
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast("خطا: فیلد نام در کارت ویزیت الزامی است", "error");
      return;
    }
    setErrors({});
    onSave();
  };

  return (
    <div style={{ ...T.card, borderColor: isMine ? "#2a1a3a" : "#1a2a1a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: isMine ? "#a89bd4" : "#5fd180", fontWeight: 600 }}>
          {isMine ? "🆔 کارت من" : "👤 همکار / تامین‌کننده"}
        </span>
        {!isMine && onDelete && (
          <button style={T.iconBtn} onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}>
            <Trash2 size={13} color="#e08a8a" />
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {fields.map(({ key, label, placeholder }) => {
          const isError = errors[key];
          return (
            <div key={key}>
              <div style={{ fontSize: 8.5, color: isError ? "#ef4444" : "#555", marginBottom: 2 }}>{label}</div>
              <div style={{ position: "relative" }}>
                <input
                  style={{
                    ...T.input,
                    borderColor: isError ? "#ef4444" : "#2a2a2a",
                    background: isError ? "#2a1414" : "#121212",
                    ...(key === "whatsapp" ? { direction: "ltr", textAlign: "left" } : {}),
                    ...(isMine && key === "name" ? { paddingLeft: 26 } : {}),
                  }}
                  value={card[key] || ""}
                  onChange={(e) => {
                    if (errors[key]) setErrors(prev => ({ ...prev, [key]: false }));
                    const v = key === "whatsapp" ? formatPhoneInput(e.target.value) : e.target.value;
                    onChange(card.id, key, v);
                  }}
                  placeholder={placeholder}
                  dir={(key === "website" || key === "email" || key === "whatsapp") ? "ltr" : "rtl"}
                />
                {isMine && key === "name" && card.name && card.name !== DEFAULT_MY_CARD_NAME && (
                  <button
                    type="button"
                    onClick={() => onChange(card.id, "name", DEFAULT_MY_CARD_NAME)}
                    title="برگشت به نام پیش‌فرض"
                    style={{
                      position: "absolute",
                      left: 6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "#666",
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div>
          <div style={{ fontSize: 8.5, color: "#555", marginBottom: 2 }}>شماره‌های تماس</div>
          {phones.map((p, idx) => (
            <div key={idx} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <input
                style={{ ...T.input, flex: 1, direction: "ltr", textAlign: "left" }}
                value={p}
                onChange={(e) => handlePhoneChange(idx, e.target.value)}
                placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
              />
              {phones.length > 1 && (
                <button style={T.iconBtn} onClick={() => removePhoneField(idx)}>
                  <Trash2 size={12} color="#e08a8a" />
                </button>
              )}
            </div>
          ))}
          <button style={{ ...T.chip, marginTop: 4, borderStyle: "dashed" }} onClick={addPhoneField}>
            <Plus size={10} /> افزودن شماره
          </button>
        </div>

        {/* Images archive */}
        <div style={{ marginTop: 10, borderTop: "1px solid #232323", paddingTop: 10 }}>
          <div style={{ fontSize: 8.5, color: "#555", marginBottom: 4, fontWeight: 600 }}>
            آرشیو تصاویر مدارک و قراردادها ({Array.isArray(card.images) ? card.images.length : 0})
          </div>
          
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {Array.isArray(card.images) && card.images.map((img, idx) => (
              <div key={idx} style={{ position: "relative", width: 50, height: 50, borderRadius: 6, overflow: "hidden", border: "1px solid #333" }}>
                <CardImage filename={img} category={IMAGE_CATEGORIES.CARD} style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                <button
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    background: "rgba(0,0,0,0.7)",
                    border: "none",
                    borderRadius: "50%",
                    width: 14,
                    height: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 8,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    const nextImgs = card.images.filter((_, i) => i !== idx);
                    onChange(card.id, "images", nextImgs);
                    deleteImageFile(img, IMAGE_CATEGORIES.CARD);
                  }}
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "#1c1c1c",
              border: "1px dashed #444",
              color: "#aaa",
              fontSize: 10,
              padding: "5px 10px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            <Plus size={10} /> آپلود تصویر سند / کارت
            <input
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFileChange(e, "images")}
            />
          </label>
        </div>

        {/* QR Code upload (only for My Card) */}
        {isMine && (
          <div style={{ marginTop: 10, borderTop: "1px solid #232323", paddingTop: 10 }}>
            <div style={{ fontSize: 8.5, color: "#555", marginBottom: 4, fontWeight: 600 }}>
              تصویر اختصاصی QR کد (جهت نمایش در تب کاتالوگ)
            </div>
            {card.qrCode && (
              <div style={{ position: "relative", width: 64, height: 64, background: "#fff", padding: 4, borderRadius: 6, marginBottom: 6, border: "1px solid #333" }}>
                <CardImage filename={card.qrCode} category={IMAGE_CATEGORIES.QR} style={{ width: "100%", height: "100%", objectFit: "contain" }} referrerPolicy="no-referrer" />
                <button
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: "#8B1A1A",
                    border: "none",
                    borderRadius: "50%",
                    width: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 8,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    deleteImageFile(card.qrCode, IMAGE_CATEGORIES.QR);
                    onChange(card.id, "qrCode", null);
                  }}
                  type="button"
                >
                  ✕
                </button>
              </div>
            )}
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "#1c1c1c",
                border: "1px dashed #444",
                color: "#aaa",
                fontSize: 10,
                padding: "5px 10px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <Plus size={10} /> آپلود تصویر QR کد
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleFileChange(e, "qrCode")}
              />
            </label>
          </div>
        )}
      </div>

      {!isMine && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            style={{ ...T.chip, flex: 1, background: "#a89bd4", color: "#000", border: "none", height: 32, justifyContent: "center" }}
            onClick={handleValidateAndSave}
          >
            تایید
          </button>
          <button
            style={{ ...T.chip, flex: 1, background: "#1a1a1a", color: "#888", border: "1px solid #333", height: 32, justifyContent: "center" }}
            onClick={onCancel}
          >
            لغو
          </button>
        </div>
      )}
    </div>
  );
}

// ── مودال اصلی ──
export default function BusinessCardModal({
  onClose,
  myCard,
  cards,
  onSave,
  isManagement = false,
  hidePartners = false,
}) {
  useRegisterOpenModal(true);
  const [activeTab, setActiveTab] = useState("mine"); // "mine" | "partners"
  // سوایپ چپ/راست بین «ریفرش» و «همکاران» — دقیقاً همون هوکی که برای تب‌های
  // اصلی/مدیریتی استفاده می‌شه؛ وقتی hidePartners باشه (فقط نمای خودِ کارت،
  // بدون تب همکاران) غیرفعاله چون چیزی برای سوییچ نیست
  const BC_TAB_ORDER = ["mine", "partners"];
  const { containerRef: bcSwipeRef, swipeHandlers: bcSwipeHandlers } = useSwipeTabNav(BC_TAB_ORDER, activeTab, setActiveTab, hidePartners);
  const bcTabSlideClass = useTabSlideClass(BC_TAB_ORDER, activeTab);
  const [editMode, setEditMode] = useState(false);
  const [localMyCard, setLocalMyCard] = useState(() => ({ ...myCard }));
  const [localCards, setLocalCards] = useState(() => (cards || []).map((c) => ({ ...c })));
  const [editingCardId, setEditingCardId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleMyCardChange = (id, key, value) => {
    setLocalMyCard((prev) => ({ ...prev, [key]: value }));
  };

  const handleCardChange = (id, key, value) => {
    setLocalCards((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
  };

  const handleDeleteCard = (id) => {
    setConfirmDeleteId(id);
  };

  const handleAddCard = () => {
    const newId = uid();
    const newCard = { ...emptyBusinessCard(), id: newId, isMine: false };
    setLocalCards((prev) => [...prev, newCard]);
    setEditingCardId(newId);
  };

  const { showToast } = useToast();

  const handleSave = () => {
    if (!localMyCard.name || !localMyCard.name.trim()) {
      showToast("خطا: نام کارت من الزامی است", "error");
      setActiveTab("mine");
      setEditMode(true);
      return;
    }
    onSave(localMyCard, localCards);
    onClose();
  };

  const isEditing = isManagement && editMode;

  // بخش ۳ (تأیید خروج): اگه توی حالت ویرایش، چیزی نسبت به لحظه‌ی بازشدن مودال
  // تغییر کرده باشه، بستن مودال یا زدن «لغو» باید اول یه تاییدیه بگیره
  const openSnapshotRef = useRef(null);
  if (openSnapshotRef.current === null) {
    openSnapshotRef.current = JSON.stringify({ myCard, cards: cards || [] });
  }
  const isDirty = () => JSON.stringify({ myCard: localMyCard, cards: localCards }) !== openSnapshotRef.current;
  const [discardAction, setDiscardAction] = useState(null); // "cancelEdit" | "closeModal" | null

  const doCancelEdit = () => {
    setEditMode(false);
    setEditingCardId(null);
    setLocalMyCard({ ...myCard });
    setLocalCards((cards || []).map((c) => ({ ...c })));
  };
  const requestCancelEdit = () => {
    if (isDirty()) setDiscardAction("cancelEdit");
    else doCancelEdit();
  };
  const requestCloseModal = () => {
    if (isEditing && isDirty()) setDiscardAction("closeModal");
    else onClose();
  };

  return (
    <div style={T.overlay} onClick={(e) => e.target === e.currentTarget && requestCloseModal()}>
      <div style={T.modal} dir="rtl">
        <div style={T.header}>
          <button style={T.iconBtn} onClick={requestCloseModal}>
            <X size={16} color="#888" />
          </button>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#F5F0EB" }}>
            {isManagement ? "مدیریت کارت ویزیت" : "کارت ویزیت"}
          </span>
          {isManagement && (
            <div style={{ display: "flex", gap: 8 }}>
              {editMode ? (
                <>
                  <button
                    style={{ ...T.chip, background: "#7aa8d8", color: "#000", border: "none" }}
                    onClick={handleSave}
                  >
                    <Save size={12} style={{ marginLeft: 4 }} /> ذخیره
                  </button>
                  <button
                    style={{ ...T.chip, background: "#1a1a1a", color: "#e08a8a", border: "1px solid #333" }}
                    onClick={requestCancelEdit}
                  >
                    لغو
                  </button>
                </>
              ) : (
                <button
                  style={{
                    ...T.chip,
                    background: "#1c1c1c",
                    border: "1px solid #2a2a2a",
                    color: "#888",
                  }}
                  onClick={() => {
                    setEditMode(true);
                    setEditingCardId(null);
                  }}
                >
                  <Edit3 size={12} style={{ marginLeft: 4 }} /> ویرایش
                </button>
              )}
            </div>
          )}
        </div>

        {!hidePartners && (
          <div style={{ display: "flex", background: "#1a1a1a", borderBottom: "1px solid #2a2a2a" }}>
            <button
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: 11,
                fontFamily: "inherit",
                background: activeTab === "mine" ? "#222" : "transparent",
                color: activeTab === "mine" ? "#a89bd4" : "#666",
                border: "none",
                borderBottom: activeTab === "mine" ? "2px solid #a89bd4" : "none",
                cursor: "pointer",
              }}
              onClick={() => setActiveTab("mine")}
            >
              ریفرش
            </button>
            <button
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: 11,
                fontFamily: "inherit",
                background: activeTab === "partners" ? "#222" : "transparent",
                color: activeTab === "partners" ? "#5fd180" : "#666",
                border: "none",
                borderBottom: activeTab === "partners" ? "2px solid #5fd180" : "none",
                cursor: "pointer",
              }}
              onClick={() => setActiveTab("partners")}
            >
              همکاران
            </button>
          </div>
        )}

        <div style={T.body} ref={bcSwipeRef} {...bcSwipeHandlers}>
        <div key={activeTab} className={bcTabSlideClass}>
          {/* ── بخش کارت من ── */}
          {(activeTab === "mine" || hidePartners) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <User size={14} color="#a89bd4" />
                <span style={{ fontSize: 11, color: "#a89bd4", fontWeight: 600 }}>ریفرش</span>
              </div>
              {isEditing ? (
                <CardEditor
                  card={localMyCard}
                  onChange={handleMyCardChange}
                  onSave={() => setEditMode(false)}
                  onCancel={() => setEditMode(false)}
                  isMine={true}
                />
              ) : (
                <CardView card={localMyCard} forceExpanded={true} isMine={true} />
              )}
            </div>
          )}

          {/* ── بخش همکاران ── */}
          {!hidePartners && activeTab === "partners" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Users size={14} color="#5fd180" />
                  <span style={{ fontSize: 11, color: "#5fd180", fontWeight: 600 }}>
                    همکاران و تامین‌کنندگان
                  </span>
                  <span style={{ fontSize: 9, color: "#555", background: "#1a1a1a", padding: "0 6px", borderRadius: 6 }}>
                    {localCards.length}
                  </span>
                </div>
                {isEditing && !editingCardId && (
                  <button style={{ ...T.chip, color: "#7aa8d8" }} onClick={handleAddCard}>
                    <Plus size={12} /> افزودن جدید
                  </button>
                )}
              </div>

              {isEditing ? (
                editingCardId ? (
                  <CardEditor
                    card={localCards.find(c => c.id === editingCardId)}
                    onChange={handleCardChange}
                    onDelete={handleDeleteCard}
                    onSave={() => setEditingCardId(null)}
                    onCancel={() => setEditingCardId(null)}
                    isMine={false}
                  />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {localCards.map((card) => (
                      <div 
                        key={card.id} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 8, 
                          background: "#121212", 
                          padding: "10px 12px", 
                          borderRadius: 10, 
                          border: "1px solid #232323" 
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "#ddd" }}>{card.name}</div>
                          <div style={{ fontSize: 9, color: "#666" }}>
                            {Array.isArray(card.phones) && card.phones[0] ? formatPhoneInput(card.phones[0]) : (card.phone ? formatPhoneInput(card.phone) : "بدون شماره")}
                          </div>
                        </div>
                        <button style={T.iconBtn} onClick={() => setEditingCardId(card.id)}>
                          <Edit3 size={13} color="#7aa8d8" />
                        </button>
                        <button style={T.iconBtn} onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }}>
                          <Trash2 size={13} color="#e08a8a" />
                        </button>
                      </div>
                    ))}
                    {localCards.length === 0 && (
                      <div style={{ fontSize: 10.5, color: "#444", textAlign: "center", padding: "20px 0" }}>
                        همکار یا تامین‌کننده اضافه کنید.
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {localCards.map((card) => (
                    <CardView key={card.id} card={card} />
                  ))}
                  {localCards.length === 0 && (
                    <div style={{ fontSize: 10.5, color: "#444", textAlign: "center", padding: "20px 0" }}>
                      هیچ همکاری ثبت نشده است.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
        </div>
      </div>
      {discardAction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.84)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ width: "88%", maxWidth: 340, background: "#181818", border: "1px solid #2a2a2a", borderRadius: 14, padding: 20 }} dir="rtl">
            <div style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB", marginBottom: 8 }}>لغو کنید؟</div>
            <div style={{ fontSize: 11, color: "#777", lineHeight: 1.65, marginBottom: 18 }}>تغییراتی که ذخیره نکردی از دست می‌ره.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, background: "transparent", border: "1px solid #2a2a2a", color: "#777", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={() => setDiscardAction(null)}>ادامه ویرایش</button>
              <button style={{ flex: 1, background: "#8B1A1A", border: "none", color: "#fff", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={() => {
                const action = discardAction;
                setDiscardAction(null);
                if (action === "cancelEdit") doCancelEdit();
                else if (action === "closeModal") { doCancelEdit(); onClose(); }
              }}>لغو کن</button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.84)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ width: "88%", maxWidth: 340, background: "#181818", border: "1px solid #2a2a2a", borderRadius: 14, padding: 20 }} dir="rtl">
            <div style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB", marginBottom: 8 }}>حذف کارت همکار</div>
            <div style={{ fontSize: 11, color: "#777", lineHeight: 1.65, marginBottom: 18 }}>آیا از حذف این همکار اطمینان دارید؟ این تغییر پس از کلیک روی دکمه ذخیره اعمال می‌شود.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, background: "transparent", border: "1px solid #2a2a2a", color: "#777", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={() => setConfirmDeleteId(null)}>انصراف</button>
              <button style={{ flex: 1, background: "#8B1A1A", border: "none", color: "#fff", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={() => {
                setLocalCards((prev) => prev.filter((c) => c.id !== confirmDeleteId));
                if (editingCardId === confirmDeleteId) setEditingCardId(null);
                setConfirmDeleteId(null);
              }}>حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}