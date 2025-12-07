const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const forge = require("node-forge");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Storage voor sessies en ondertekende documenten
const sessions = new Map();
const signedDocuments = new Map();

// Multer configuratie voor file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limiet
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Alleen PDF bestanden zijn toegestaan"));
    }
  },
});

// Genereer RSA key pair voor signing
const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(2048);
const publicKeyPem = forge.pki.publicKeyToPem(publicKey);
console.log("🔑 Server signing key pair gegenereerd");

/**
 * Start een disclosure sessie (mock)
 * In een echte implementatie zou dit met de verification server communiceren
 */
app.post("/api/sessions/start", async (req, res) => {
  try {
    const { usecase } = req.body;
    const sessionToken = uuidv4();
    
    console.log(`📝 Nieuwe sessie gestart: ${sessionToken}`);
    
    // Mock: na 2 seconden zijn de credentials beschikbaar
    sessions.set(sessionToken, {
      sessionToken,
      status: "pending",
      credentials: null,
    });
    
    // Simuleer disclosure na 2 seconden
    setTimeout(() => {
      const session = sessions.get(sessionToken);
      if (session) {
        session.status = "completed";
        session.credentials = {
          given_name: "Jan",
          family_name: "Jansen",
          birth_date: "1990-05-15",
          document_number: "NLD123456789",
          nationality: "Nederlandse",
        };
        console.log(`✅ Credentials beschikbaar voor sessie: ${sessionToken}`);
      }
    }, 2000);
    
    res.json({
      status_url: `http://localhost:${PORT}/api/sessions/${sessionToken}/status`,
      session_token: sessionToken,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Haal sessie status op
 */
app.get("/api/sessions/:sessionId/status", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: "Sessie niet gevonden" });
  }
  
  res.json({
    status: session.status,
    session_token: sessionId,
  });
});

/**
 * Haal disclosed credentials op
 */
app.get("/api/sessions/:sessionId/credentials", (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: "Sessie niet gevonden" });
  }
  
  if (session.status !== "completed" || !session.credentials) {
    return res.status(202).json({
      status: "pending",
      message: "Credentials nog niet beschikbaar",
    });
  }
  
  res.json({
    credentials: session.credentials,
    session_token: sessionId,
  });
});

/**
 * Onderteken een PDF document
 */
app.post("/api/documents/sign", upload.single("document"), async (req, res) => {
  try {
    const { sessionToken, credentials: credentialsJson } = req.body;
    const credentials = JSON.parse(credentialsJson);
    
    if (!req.file) {
      return res.status(400).json({ error: "Geen document geüpload" });
    }
    
    console.log(`📄 Document ondertekenen voor sessie: ${sessionToken}`);
    
    // Laad de PDF
    const pdfDoc = await PDFDocument.load(req.file.buffer);
    
    // Haal de eerste pagina
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    
    // Embed fonts
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Voeg signature block toe
    const signatureY = 50;
    const lineHeight = 14;
    let currentY = signatureY;
    
    // Teken signature box
    firstPage.drawRectangle({
      x: 50,
      y: signatureY - 10,
      width: width - 100,
      height: 140,
      borderColor: rgb(0.4, 0.49, 0.92),
      borderWidth: 2,
      color: rgb(0.95, 0.96, 1),
    });
    
    // Titel
    firstPage.drawText("DIGITAAL ONDERTEKEND MET NL WALLET", {
      x: 60,
      y: signatureY + 110,
      size: 12,
      font: boldFont,
      color: rgb(0.4, 0.49, 0.92),
    });
    
    // Credentials
    currentY = signatureY + 85;
    const entries = [
      ["Naam:", `${credentials.given_name || ""} ${credentials.family_name || ""}`],
      ["Geboortedatum:", credentials.birth_date],
      ["Document:", credentials.document_number],
      ["Ondertekend op:", new Date().toLocaleString("nl-NL")],
    ];
    
    entries.forEach(([label, value]) => {
      firstPage.drawText(label, {
        x: 60,
        y: currentY,
        size: 9,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3),
      });
      
      firstPage.drawText(String(value || ""), {
        x: 150,
        y: currentY,
        size: 9,
        font: font,
        color: rgb(0, 0, 0),
      });
      currentY -= lineHeight;
    });
    
    // Maak signature data
    const signatureData = {
      sessionToken,
      credentials,
      documentHash: null,
      timestamp: new Date().toISOString(),
      signedBy: `${credentials.given_name || ""} ${credentials.family_name || ""}`,
    };
    
    // Bereken document hash
    const pdfBytes = await pdfDoc.save();
    const md = forge.md.sha256.create();
    md.update(Buffer.from(pdfBytes).toString("binary"));
    const documentHash = md.digest().toHex();
    signatureData.documentHash = documentHash;
    
    // Onderteken de signature data
    const dataToSign = JSON.stringify({
      documentHash,
      sessionToken,
      timestamp: signatureData.timestamp,
      signer: signatureData.signedBy,
    });
    
    const md2 = forge.md.sha256.create();
    md2.update(dataToSign, "utf8");
    const signature = privateKey.sign(md2);
    const signatureBase64 = forge.util.encode64(signature);
    signatureData.signature = signatureBase64;
    
    // Sla ondertekend document metadata op
    const documentId = uuidv4();
    signedDocuments.set(documentId, {
      ...signatureData,
      originalFileName: req.file.originalname,
      signedAt: new Date().toISOString(),
    });
    
    // Voeg signature metadata toe aan PDF
    const signatureText = `Signature ID: ${documentId}\nVerifieer op: ${req.protocol}://${req.get("host")}/verify.html?id=${documentId}`;
    firstPage.drawText(signatureText, {
      x: 60,
      y: signatureY + 5,
      size: 7,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    // Sla de gewijzigde PDF op
    const finalPdfBytes = await pdfDoc.save();
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ondertekend_${req.file.originalname}"`
    );
    res.send(Buffer.from(finalPdfBytes));
    
    console.log(`✅ Document ondertekend: ${documentId}`);
  } catch (error) {
    console.error("Error bij ondertekenen:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Verifieer een ondertekend document
 */
app.get("/api/documents/verify/:documentId", (req, res) => {
  const { documentId } = req.params;
  const document = signedDocuments.get(documentId);
  
  if (!document) {
    return res.status(404).json({
      verified: false,
      error: "Document niet gevonden",
    });
  }
  
  // Verifieer de signature
  try {
    const dataToVerify = JSON.stringify({
      documentHash: document.documentHash,
      sessionToken: document.sessionToken,
      timestamp: document.timestamp,
      signer: document.signedBy,
    });
    
    const md = forge.md.sha256.create();
    md.update(dataToVerify, "utf8");
    const signatureBytes = forge.util.decode64(document.signature);
    
    const verified = publicKey.verify(md.digest().bytes(), signatureBytes);
    
    if (verified) {
      res.json({
        verified: true,
        documentId,
        signer: {
          name: document.signedBy,
          credentials: document.credentials,
        },
        signedAt: document.signedAt,
        documentHash: document.documentHash,
        originalFileName: document.originalFileName,
      });
    } else {
      res.json({
        verified: false,
        error: "Signature verificatie mislukt",
      });
    }
  } catch (error) {
    console.error("Verificatie error:", error);
    res.status(500).json({
      verified: false,
      error: error.message,
    });
  }
});

/**
 * Haal publieke sleutel op voor handmatige verificatie
 */
app.get("/api/public-key", (req, res) => {
  res.json({
    publicKey: publicKeyPem,
    algorithm: "RSA-SHA256",
    keySize: 2048,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mockup Signer Backend draait op http://localhost:${PORT}`);
  console.log(`📝 API endpoints beschikbaar:`);
  console.log(`   POST /api/sessions/start`);
  console.log(`   GET  /api/sessions/:id/status`);
  console.log(`   GET  /api/sessions/:id/credentials`);
  console.log(`   POST /api/documents/sign`);
  console.log(`   GET  /api/documents/verify/:id`);
  console.log(`   GET  /api/public-key`);
});

