const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// PASTE YOUR KEY DIRECTLY HERE - NO SPACES
const MY_API_KEY = "AIzaSyBns5O45rrmDuiiJryEcpdhSTRYN_XQh-g"; 

app.post("/api", async (req, res) => {
  const { message, theme } = req.body;
  // Use backticks for console.log
  console.log(`Received debate request. Theme: ${theme}, Message: ${message}`);

  try {
    // FIXED: Using backticks (`) so ${MY_API_KEY} works
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${MY_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ 
            // FIXED: Using backticks (`) for the prompt too
            text: `返事は100文字以内にしてください。あなたは討論の達人です。テーマ「${theme}」について、次の意見に全力で反論してください：${message}` 
          }]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Google API Error Details:", JSON.stringify(data.error, null, 2));
      // FIXED: Using backticks (`) for the error message
      return res.status(400).json({ reply: `API Error: ${data.error.message}` });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI produced an empty response.";
    res.json({ reply });

  } catch (error) {
    console.error("Server Crash Error:", error);
    res.status(500).json({ reply: "The server crashed. Check the terminal." });
  }
});

app.listen(3000, () => {
  console.log("SERVER RUNNING - BACKTICKS FIXED");
});