"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBacarPassCredentials = void 0;
const functions = require("firebase-functions/v2/https");
const params = require("firebase-functions/params");
const admin = require("firebase-admin");
/** Ruta: artifacts (col) / bacarpass-v1 (doc) / public (col) / data (doc) / passwords (col) */
function getBacarPassCollection(db) {
    return db
        .collection("artifacts")
        .doc("bacarpass-v1")
        .collection("public")
        .doc("data")
        .collection("passwords");
}
const bacarPassServiceAccount = params.defineSecret("BACARPASS_SERVICE_ACCOUNT_JSON");
/**
 * Cloud Function: getBacarPassCredentials
 * - Solo usuarios autenticados del IT Ops Hub (Firebase Auth).
 * - Lee credenciales del proyecto legajosonline-959f6 usando la Service Account.
 * - Ruta: artifacts/bacarpass-v1/public/data/passwords
 */
exports.getBacarPassCredentials = functions.onCall({
    region: "us-central1",
    secrets: [bacarPassServiceAccount],
}, async (request) => {
    if (!request.auth) {
        throw new functions.HttpsError("unauthenticated", "Debes iniciar sesión en el IT Ops Hub para ver las credenciales.");
    }
    let serviceAccountJson;
    try {
        serviceAccountJson = bacarPassServiceAccount.value();
    }
    catch (e) {
        throw new functions.HttpsError("internal", "Configuración del servicio BacarPass no disponible. Verifica el secreto BACARPASS_SERVICE_ACCOUNT_JSON.");
    }
    let cred;
    try {
        cred = JSON.parse(serviceAccountJson);
    }
    catch {
        throw new functions.HttpsError("internal", "El secreto BACARPASS_SERVICE_ACCOUNT_JSON no tiene un JSON válido.");
    }
    if (!admin.apps.some((a) => a.name === "bacarpass")) {
        admin.initializeApp({
            credential: admin.credential.cert(cred),
        }, "bacarpass");
    }
    const bacarDb = admin.app("bacarpass").firestore();
    const snapshot = await getBacarPassCollection(bacarDb).get();
    const list = [];
    snapshot.forEach((doc) => {
        const d = doc.data();
        list.push({
            id: doc.id,
            title: d.title ?? "",
            username: d.username ?? "",
            passwordValue: d.passwordValue ?? "",
            url: d.url ?? "",
            tag: d.tag ?? "",
        });
    });
    return list;
});
