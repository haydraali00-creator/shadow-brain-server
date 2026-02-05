const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fetch = require("node-fetch");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ULTRA PROTECTION — 1 request every 5 seconds per IP
const limiter = rateLimit({
  windowMs: 5000,
  max: 1,
  message: {
    answer: "تم حظر الطلب مؤقتًا بسبب كثرة المحاولات. حاول بعد قليل.",
    confidence: 0.0,
    source: "shadow-brain-protection"
  }
});

app.use(limiter);

// Detect language
function detectLanguage(text) {
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  return hasArabic ? "ar" : "en";
}

// Detect intent
function detectIntent(text) {
  const t = text.toLowerCase();

  if (/[?؟]/.test(t)) return "question";
  if (t.includes("ترجم") || t.includes("translate")) return "translate";
  if (t.includes("ابحث") || t.includes("search")) return "search";
  if (t.includes("مرحبا") || t.includes("hello") || t.includes("hi")) return "greeting";
  if (t.includes("أحب") || t.includes("love") || t.includes("حزين") || t.includes("sad")) return "emotion";

  return "statement";
}

// Translation API
async function translateText(text, fromLang, toLang) {
  try {
    const from = fromLang === "ar" ? "ar" : "en";
    const to = toLang === "ar" ? "ar" : "en";
    const encoded = encodeURIComponent(text);
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${from}|${to}`;

    const res = await fetch(url);
    const data = await res.json();
    if (data?.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    return null;
  } catch {
    return null;
  }
}

// Search / Definition API
async function fetchDefinition(query) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`;

    const res = await fetch(url);
    const data = await res.json();

    if (data?.AbstractText) return data.AbstractText;

    if (data?.RelatedTopics?.length > 0 && data.RelatedTopics[0].Text) {
      return data.RelatedTopics[0].Text;
    }

    return null;
  } catch {
    return null;
  }
}

// Human-like responses
function buildHumanLikeResponse(intent, lang, original, payload) {
  if (lang === "ar") {
    switch (intent) {
      case "greeting":
        return "أهلاً… تفضل، أنا معك.";
      case "emotion":
        return "أشعر بنبرة كلامك… احكي لي أكثر.";
      case "translate":
        return payload ? `ترجمت لك:\n${payload}` : "حاولت أترجم، بس ما حصلت نتيجة واضحة.";
      case "search":
      case "question":
        return payload ? `بحثت لك ووجدت:\n${payload}` : "دورت كثير، بس ما حصلت جواب مقنع.";
      default:
        return "فهمت كلامك… لو تبغى تحليل أعمق، اسألني بشكل مباشر.";
    }
  } else {
    switch (intent) {
      case "greeting":
        return "Hey, I'm here. Go ahead.";
      case "emotion":
        return "I can sense the tone… tell me more.";
      case "translate":
        return payload ? `Here's the translation:\n${payload}` : "I tried translating but couldn't get a clear result.";
      case "search":
      case "question":
        return payload ? `I looked it up and found:\n${payload}` : "I searched but couldn't find a solid answer.";
      default:
        return "Got it. Ask me something more specific if you want.";
    }
  }
}

// Main API
app.post("/shadow/query", async (req, res) => {
  try {
    const message = (req.body.message || "").trim();
    let lang = (req.body.lang || "").trim().toLowerCase();

    if (!message) {
      return res.json({
        answer: "لم يصلني أي نص.",
        confidence: 0.0,
        source: "shadow-brain"
      });
    }

    if (!lang) lang = detectLanguage(message);

    const intent = detectIntent(message);
    let payload = null;
    let source = "shadow-brain";
    let confidence = 0.5;

    // Translation
    if (intent === "translate") {
      const textToTranslate = message.replace("ترجم", "").replace("translate", "").trim();
      if (textToTranslate.length > 0) {
        const targetLang = lang === "ar" ? "en" : "ar";
        const translated = await translateText(textToTranslate, lang, targetLang);
        if (translated) {
          payload = translated;
          source = "translation-api";
          confidence = 0.9;
        }
      }
    }

    // Search / Definition
    if ((intent === "question" || intent === "search") && !payload) {
      const def = await fetchDefinition(message);
      if (def) {
        payload = def;
        source = "duckduckgo";
        confidence = 0.85;
      }
    }

    const answer = buildHumanLikeResponse(intent, lang, message, payload);

    return res.json({
      answer,
      confidence,
      source
    });
  } catch {
    return res.json({
      answer: "حدث خطأ داخل Shadow Brain.",
      confidence: 0.0,
      source: "shadow-brain-error"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Shadow Brain running on port ${PORT}`));