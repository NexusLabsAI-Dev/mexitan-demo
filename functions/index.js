const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const https = require("https");

admin.initializeApp();

// --- DEFINICIÓN DE SECRETOS (CAJA FUERTE) ---
const MP_ACCESS_TOKEN = defineSecret("MP_ACCESS_TOKEN");

function mpRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.mercadopago.com",
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    };
    const req = https.request(options, (r) => {
      let data = "";
      r.on("data", chunk => data += chunk);
      r.on("end", () => {
        try { resolve({ status: r.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: r.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// --- MERCADO PAGO ---
exports.crearIntentoPago = onRequest({ secrets: [MP_ACCESS_TOKEN], cors: true }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  const { monto, pedidoId, deviceId } = req.body;
  const result = await mpRequest("POST", `/point/integration-api/devices/${deviceId}/payment-intents`, MP_ACCESS_TOKEN.value(), {
    amount: Math.round(monto * 100),
    description: `Mexitan POS - Pedido ${pedidoId}`,
    payment: { installments: 1, type: "total_amount" },
    additional_info: { external_reference: pedidoId, print_on_terminal: true }
  });
  return res.status(result.status).json(result.body);
});

exports.verificarPago = onRequest({ secrets: [MP_ACCESS_TOKEN], cors: true }, async (req, res) => {
  const { intentId } = req.query;
  const result = await mpRequest("GET", `/point/integration-api/payment-intents/${intentId}`, MP_ACCESS_TOKEN.value());
  return res.status(result.status).json(result.body);
});

exports.webhookMP = onRequest(async (req, res) => {
  const { type, data } = req.body;
  if (type === "point_integration_wh" && data?.id) {
    const db = admin.firestore();
    await db.collection("pagos_pendientes").doc(data.id).set({
      paymentId: data.id,
      status: req.body.status || "completed",
      ts: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  return res.status(200).send("OK");
});
