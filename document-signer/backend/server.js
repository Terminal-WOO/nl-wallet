const express = require("express")
const cors = require("cors")
const multer = require("multer")
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib")
const forge = require("node-forge")
const axios = require("axios")
const { v4: uuidv4 } = require("uuid")
const fs = require("fs").promises
const path = require("path")

const app = express()
const PORT = 3001

// Verification server configuration
// Both public and private endpoints are on port 8001 when requester_server is not configured
const VERIFICATION_SERVER_URL = process.env.VERIFICATION_SERVER_URL || "http://localhost:8001"
const VERIFICATION_SERVER_PUBLIC_URL = process.env.VERIFICATION_SERVER_PUBLIC_URL || "http://localhost:8001"

// Middleware
app.use(cors())
app.use(express.json())

// Storage for sessions and signed documents
const sessions = new Map()
const signedDocuments = new Map()

// Multer configuration for file uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true)
    } else {
      cb(new Error("Only PDF files are allowed"))
    }
  },
})

// Generate RSA key pair for signing
const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(2048)
const privateKeyPem = forge.pki.privateKeyToPem(privateKey)
const publicKeyPem = forge.pki.publicKeyToPem(publicKey)
console.log("🔑 Server signing key pair generated")
console.log("Public Key:", publicKeyPem)

/**
 * Start a disclosure session with the verification server
 */
app.post("/api/sessions/start", async (req, res) => {
  try {
    const { usecase } = req.body
    console.log(`📝 Starting session for usecase: ${usecase}`)

    // Create DCQL query to request ID card attributes
    const dcqlQuery = {
      credentials: [
        {
          id: "pid_request",
          format: "mso_mdoc",
          meta: {
            doctype_value: "com.example.pid",
          },
          claims: [
            { path: ["family_name"] },
            { path: ["given_name"] },
            { path: ["birth_date"] },
            { path: ["age_over_18"] },
            { path: ["document_number"] },
          ],
        },
      ],
    }

    // Return URL for cross-device flow
    const returnUrlTemplate = `http://localhost:8080/return.html?session_token={session_token}`

    console.log(`🔗 Connecting to verification server at ${VERIFICATION_SERVER_URL}`)

    // Start session with verification server
    const response = await axios.post(
      `${VERIFICATION_SERVER_URL}/disclosure/sessions`,
      {
        usecase: usecase || "document_signing",
        dcql_query: dcqlQuery,
        return_url_template: returnUrlTemplate,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    )

    const { session_token } = response.data

    // Store session locally for later retrieval
    sessions.set(session_token, {
      sessionToken: session_token,
      usecase: usecase,
      createdAt: new Date().toISOString(),
      status: "created",
      credentials: null,
    })

    console.log(`✅ Session ${session_token} created with verification server`)

    // Return status URL and session token
    res.json({
      status_url: `${VERIFICATION_SERVER_PUBLIC_URL}/disclosure/sessions/${session_token}`,
      session_token: session_token,
    })
  } catch (error) {
    console.error("❌ Error connecting to verification server:", error.message)
    console.log("⚠️  Falling back to mock disclosure flow")

    // Fallback to mock implementation
    const sessionId = uuidv4()
    const mockSessionData = {
      sessionToken: sessionId,
      statusUrl: `http://localhost:3001/api/sessions/${sessionId}/status`,
      usecase: req.body.usecase || "document_signing",
      createdAt: new Date().toISOString(),
      status: "created",
      credentials: null,
    }

    sessions.set(sessionId, mockSessionData)

    // Simulate wallet disclosure after 3 seconds
    setTimeout(() => {
      const session = sessions.get(sessionId)
      if (session) {
        session.status = "completed"
        session.credentials = {
          given_name: "Jan",
          family_name: "Jansen",
          birth_date: "1990-01-01",
          age_over_18: true,
          document_number: "NLD123456",
        }
        sessions.set(sessionId, session)
        console.log(`✅ Mock session ${sessionId} completed with mock credentials`)
      }
    }, 3000)

    res.json({
      status_url: mockSessionData.statusUrl,
      session_token: sessionId,
    })
  }
})

/**
 * Get session status (polled by wallet_web library)
 */
app.get("/api/sessions/:sessionId/status", async (req, res) => {
  const { sessionId } = req.params
  const session = sessions.get(sessionId)

  if (!session) {
    return res.status(404).json({ error: "Session not found" })
  }

  // For mock sessions (localhost URLs), return status directly from local store
  if (session.statusUrl && session.statusUrl.includes("localhost:3001")) {
    return res.json({
      status: session.status.toUpperCase(),
    })
  }

  // For real verification server sessions, query the server
  try {
    const response = await axios.get(`${VERIFICATION_SERVER_PUBLIC_URL}/disclosure/sessions/${sessionId}`)

    const { status, ul } = response.data

    // Update local session
    session.status = status.toLowerCase()
    sessions.set(sessionId, session)

    res.json({
      status: status,
      ul: ul,
    })
  } catch (error) {
    console.error(`❌ Error getting session status for ${sessionId}:`, error.message)
    // Fallback to local session status for mock sessions
    res.json({
      status: session.status.toUpperCase(),
    })
  }
})

/**
 * Create a disclosure request and return deep link URL for wallet
 */
app.post("/api/disclosure/request", async (req, res) => {
  try {
    const { usecase } = req.body
    const requestId = uuidv4()

    console.log(`🔗 Creating disclosure request: ${requestId}`)

    // Create disclosure request session
    const requestData = {
      sessionToken: requestId,
      usecase: usecase || "document_signing",
      createdAt: new Date().toISOString(),
      status: "pending",
      credentials: null,
      requested_attributes: ["given_name", "family_name", "birth_date", "age_over_18", "document_number"],
    }

    sessions.set(requestId, requestData)

    // Create deep link URL for wallet using deeplink format with JSON fragment
    const callbackUrl = `http://localhost:3001/api/disclosure/callback`
    const deepLinkData = {
      type: "verify",
      id: "JOB_APPLICATION", // Use a recognized mock scenario
      callback: callbackUrl,
      request_id: requestId,
    }
    const deepLinkUrl = `walletdebuginteraction://deeplink#${encodeURIComponent(JSON.stringify(deepLinkData))}`

    console.log(`✅ Disclosure request created: ${requestId}`)
    console.log(`🔗 Deep link URL: ${deepLinkUrl}`)

    res.json({
      request_id: requestId,
      deep_link_url: deepLinkUrl,
      status_url: `http://localhost:3001/api/sessions/${requestId}/status`,
      callback_url: callbackUrl,
    })
  } catch (error) {
    console.error("❌ Error creating disclosure request:", error)
    res.status(500).json({
      error: error.message,
    })
  }
})

/**
 * Disclosure callback endpoint - receives data directly from wallet app
 */
app.post("/api/disclosure/callback", async (req, res) => {
  try {
    const { request_id, credentials } = req.body

    console.log(`📱 Received disclosure callback for request: ${request_id}`)
    console.log(`📋 Disclosed credentials:`, JSON.stringify(credentials, null, 2))

    if (!request_id || !credentials) {
      return res.status(400).json({
        success: false,
        error: "Missing request_id or credentials",
      })
    }

    // Find or create session for this request
    let session = sessions.get(request_id)
    if (!session) {
      // Create new session from callback
      session = {
        sessionToken: request_id,
        usecase: "document_signing",
        createdAt: new Date().toISOString(),
        status: "completed",
        credentials: credentials,
        source: "wallet_callback",
      }
    } else {
      // Update existing session
      session.status = "completed"
      session.credentials = credentials
      session.completedAt = new Date().toISOString()
    }

    sessions.set(request_id, session)
    console.log(`✅ Session ${request_id} updated with disclosed credentials`)

    // Return success to wallet
    res.json({
      success: true,
      message: "Credentials received successfully",
      request_id: request_id,
    })
  } catch (error) {
    console.error("❌ Error processing disclosure callback:", error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * Get disclosed credentials for a session
 */
app.get("/api/sessions/:sessionId/credentials", async (req, res) => {
  const { sessionId } = req.params
  const session = sessions.get(sessionId)

  if (!session) {
    return res.status(404).json({ error: "Session not found" })
  }

  // For mock sessions, return credentials from local store
  if (session.statusUrl && session.statusUrl.includes("localhost:3001")) {
    if (!session.credentials) {
      return res.status(400).json({ error: "Session not completed or no credentials available" })
    }

    return res.json({
      credentials: session.credentials,
      session_token: sessionId,
    })
  }

  // For real verification server sessions
  try {
    const response = await axios.get(`${VERIFICATION_SERVER_URL}/disclosure/sessions/${sessionId}/disclosed_attributes`)

    const disclosedData = response.data

    // Parse and flatten the credentials
    const credentials = {}

    if (Array.isArray(disclosedData) && disclosedData.length > 0) {
      disclosedData.forEach((item) => {
        if (item.attestations && Array.isArray(item.attestations)) {
          item.attestations.forEach((attestation) => {
            if (attestation.attributes) {
              Object.assign(credentials, attestation.attributes)
            }
          })
        }
      })
    }

    // Update local session
    session.credentials = credentials
    session.status = "completed"
    sessions.set(sessionId, session)

    console.log(`✅ Retrieved credentials for session ${sessionId}:`, credentials)

    res.json({
      credentials: credentials,
      session_token: sessionId,
    })
  } catch (error) {
    console.error(`❌ Error getting credentials for ${sessionId}:`, error.message)
    // Fallback to local session credentials for mock sessions
    if (session.credentials) {
      return res.json({
        credentials: session.credentials,
        session_token: sessionId,
      })
    }
    res.status(error.response?.status || 500).json({
      error: error.message,
    })
  }
})

/**
 * Sign a PDF document with disclosed credentials
 */
app.post("/api/documents/sign", upload.single("document"), async (req, res) => {
  try {
    const { sessionToken, credentials: credentialsJson } = req.body
    const credentials = JSON.parse(credentialsJson)

    if (!req.file) {
      return res.status(400).json({ error: "No document uploaded" })
    }

    console.log(`📄 Signing document for session: ${sessionToken}`)

    // Load the PDF
    const pdfDoc = await PDFDocument.load(req.file.buffer)

    // Get the first page
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]
    const { width, height } = firstPage.getSize()

    // Embed font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Add signature block
    const signatureY = 50
    const lineHeight = 14
    let currentY = signatureY

    // Draw signature box
    firstPage.drawRectangle({
      x: 50,
      y: signatureY - 10,
      width: width - 100,
      height: 140,
      borderColor: rgb(0.4, 0.49, 0.92),
      borderWidth: 2,
      color: rgb(0.95, 0.96, 1),
    })

    // Title
    firstPage.drawText("DIGITAAL ONDERTEKEND", {
      x: 60,
      y: signatureY + 110,
      size: 12,
      font: boldFont,
      color: rgb(0.4, 0.49, 0.92),
    })

    // Credentials
    currentY = signatureY + 85
    const entries = [
      [
        "Naam:",
        `${credentials.given_name || credentials.first_name || ""} ${credentials.family_name || credentials.last_name || ""}`,
      ],
      ["Geboortedatum:", credentials.birth_date],
      ["Document:", credentials.document_number],
      ["Ondertekend op:", new Date().toLocaleString("nl-NL")],
    ]

    entries.forEach(([label, value]) => {
      firstPage.drawText(label, {
        x: 60,
        y: currentY,
        size: 9,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3),
      })
      firstPage.drawText(String(value || ""), {
        x: 150,
        y: currentY,
        size: 9,
        font: font,
        color: rgb(0, 0, 0),
      })
      currentY -= lineHeight
    })

    // Create signature data
    const signatureData = {
      sessionToken,
      credentials,
      documentHash: null, // Will be calculated
      timestamp: new Date().toISOString(),
      signedBy: `${credentials.given_name || credentials.first_name || ""} ${credentials.family_name || credentials.last_name || ""}`,
    }

    // Calculate document hash
    const pdfBytes = await pdfDoc.save()
    const md = forge.md.sha256.create()
    md.update(Buffer.from(pdfBytes).toString("binary"))
    const documentHash = md.digest().toHex()
    signatureData.documentHash = documentHash

    // Sign the signature data
    const dataToSign = JSON.stringify({
      documentHash,
      sessionToken,
      timestamp: signatureData.timestamp,
      signer: signatureData.signedBy,
    })

    const md2 = forge.md.sha256.create()
    md2.update(dataToSign, "utf8")
    const signature = privateKey.sign(md2)
    const signatureBase64 = forge.util.encode64(signature)
    signatureData.signature = signatureBase64

    // Store signed document metadata
    const documentId = uuidv4()
    signedDocuments.set(documentId, {
      ...signatureData,
      originalFileName: req.file.originalname,
      signedAt: new Date().toISOString(),
    })

    // Add signature metadata to PDF
    const signatureText = `Signature ID: ${documentId}\nVerify at: ${req.protocol}://${req.get("host")}/verify.html?id=${documentId}`
    firstPage.drawText(signatureText, {
      x: 60,
      y: signatureY + 5,
      size: 7,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    })

    // Save the modified PDF
    const finalPdfBytes = await pdfDoc.save()

    console.log(`✅ Document signed successfully. ID: ${documentId}`)

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="signed_${req.file.originalname}"`)
    res.send(Buffer.from(finalPdfBytes))
  } catch (error) {
    console.error("Error signing document:", error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Verify a signed document
 */
app.get("/api/documents/verify/:documentId", (req, res) => {
  const { documentId } = req.params
  const signedDoc = signedDocuments.get(documentId)

  if (!signedDoc) {
    return res.status(404).json({
      verified: false,
      error: "Document not found",
    })
  }

  try {
    // Verify signature
    const dataToVerify = JSON.stringify({
      documentHash: signedDoc.documentHash,
      sessionToken: signedDoc.sessionToken,
      timestamp: signedDoc.timestamp,
      signer: signedDoc.signedBy,
    })

    const md = forge.md.sha256.create()
    md.update(dataToVerify, "utf8")
    const signature = forge.util.decode64(signedDoc.signature)
    const verified = publicKey.verify(md.digest().bytes(), signature)

    res.json({
      verified,
      documentId,
      signer: {
        name: signedDoc.signedBy,
        credentials: signedDoc.credentials,
      },
      signedAt: signedDoc.signedAt,
      documentHash: signedDoc.documentHash,
      originalFileName: signedDoc.originalFileName,
    })
  } catch (error) {
    console.error("Error verifying document:", error)
    res.status(500).json({
      verified: false,
      error: error.message,
    })
  }
})

/**
 * Get public key for verification
 */
app.get("/api/public-key", (req, res) => {
  res.json({
    publicKey: publicKeyPem,
    algorithm: "RSA-SHA256",
    keySize: 2048,
  })
})

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    sessions: sessions.size,
    signedDocuments: signedDocuments.size,
    verificationServer: VERIFICATION_SERVER_URL,
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Document Signer Backend running on http://localhost:${PORT}`)
  console.log(`🔗 Verification Server: ${VERIFICATION_SERVER_URL}`)
  console.log(`📋 Endpoints:`)
  console.log(`   POST /api/sessions/start - Start disclosure session`)
  console.log(`   GET  /api/sessions/:id/status - Get session status`)
  console.log(`   GET  /api/sessions/:id/credentials - Get disclosed credentials`)
  console.log(`   POST /api/documents/sign - Sign PDF document`)
  console.log(`   GET  /api/documents/verify/:id - Verify signed document`)
  console.log(`   GET  /api/public-key - Get server public key`)
})
