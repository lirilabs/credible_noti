import admin from "firebase-admin";
import nodemailer from "nodemailer";

/* ======================================================
   Firebase Admin Initialization
====================================================== */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

/* ======================================================
   SMTP Transport
====================================================== */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

/* ======================================================
   API Handler (WHATWG URL FIX)
====================================================== */
export default async function handler(req, res) {
  /* -------- CORS -------- */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  try {
    /* -------- SAFE URL PARSING (NO url.parse) -------- */
    const url = new URL(req.url, `https://${req.headers.host}`);
    const uid = url.searchParams.get("uid");
    const title = url.searchParams.get("title");
    const content = url.searchParams.get("content");

    if (!uid || !title || !content) {
      return res.status(400).json({
        error: "uid, title and content query params are required",
      });
    }

    /* -------- Firebase User -------- */
    const user = await admin.auth().getUser(uid);

    if (!user.email) {
      return res.status(400).json({
        error: "User does not have an email",
      });
    }

    /* -------- Send Email -------- */
    await transporter.sendMail({
      from: `"Credible" <${process.env.SMTP_EMAIL}>`,
      to: user.email,
      subject: title,
      text: content,
      html: `<p>${content.replace(/\n/g, "<br/>")}</p>`,
    });

    return res.status(200).json({
      success: true,
      uid,
      email: user.email,
      message: "Email sent successfully",
    });

  } catch (err) {
    console.error("MAIL ERROR:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
