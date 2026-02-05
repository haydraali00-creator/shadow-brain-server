const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios"); // استبدلنا fetch بـ axios
const rateLimit = require("express-rate-limit");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const limiter = rateLimit({
  windowMs: 5000,
  max: 1,
  message: { answer: "اهداً قليلاً.. الظل يحتاج وقتاً للتفكير." }
});
app.use(limiter);

function detectLanguage(text) {
  return /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
}

app.post("/shadow/query", async (req, res) => {
  try {
    const message = (req.body.message || "").trim();
    const lang = detectLanguage(message);

    // رد افتراضي سريع للذكاء
    let answer = lang === "ar" ? "فهمت كلامك.. أنا الظل، كيف أساعدك؟" : "I hear you.. I am Shadow, how can I help?";

    // تجربة البحث السريع (DuckDuckGo) باستخدام axios
    try {
      const searchRes = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(message)}&format=json&no_html=1`);
      if (searchRes.data && searchRes.data.AbstractText) {
        answer = searchRes.data.AbstractText;
      }
    } catch (e) { /* استمر بالرد الافتراضي لو فشل البحث */ }

    res.json({ answer: answer, source: "shadow-core" });
  } catch (err) {
    res.json({ answer: "عذراً، حدث تداخل في التفكير السحابي.", error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Shadow Brain is stable on port ${PORT}`));
