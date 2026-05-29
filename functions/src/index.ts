import * as functions from "firebase-functions/v2/https";
import * as params from "firebase-functions/params";
import * as admin from "firebase-admin";

/** Ruta: artifacts (col) / bacarpass-v1 (doc) / public (col) / data (doc) / passwords (col) */
function getBacarPassCollection(db: admin.firestore.Firestore): admin.firestore.CollectionReference {
  return db
    .collection("artifacts")
    .doc("bacarpass-v1")
    .collection("public")
    .doc("data")
    .collection("passwords");
}

/** Interfaz para documentos de Firestore en BacarPass */
interface BacarPassDoc {
  title?: string;
  username?: string;
  passwordValue?: string;
  url?: string;
  tag?: string;
  [key: string]: unknown;
}

/** Credencial mapeada para el frontend */
export interface BacarPassCredentialResponse {
  id: string;
  title: string;
  username: string;
  passwordValue: string;
  url: string;
  tag: string;
}

const bacarPassServiceAccount = params.defineSecret("BACARPASS_SERVICE_ACCOUNT_JSON");

/**
 * Cloud Function: getBacarPassCredentials
 * - Solo usuarios autenticados del IT Ops Hub (Firebase Auth).
 * - Lee credenciales del proyecto legajosonline-959f6 usando la Service Account.
 * - Ruta: artifacts/bacarpass-v1/public/data/passwords
 */
export const getBacarPassCredentials = functions.onCall(
  {
    region: "us-central1",
    secrets: [bacarPassServiceAccount],
  },
  async (request): Promise<BacarPassCredentialResponse[]> => {
    if (!request.auth) {
      throw new functions.HttpsError(
        "unauthenticated",
        "Debes iniciar sesión en el IT Ops Hub para ver las credenciales."
      );
    }

    let serviceAccountJson: string;
    try {
      serviceAccountJson = bacarPassServiceAccount.value();
    } catch {
      throw new functions.HttpsError(
        "internal",
        "Configuración del servicio BacarPass no disponible. Verifica el secreto BACARPASS_SERVICE_ACCOUNT_JSON."
      );
    }

    let cred: admin.ServiceAccount;
    try {
      cred = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    } catch {
      throw new functions.HttpsError(
        "internal",
        "El secreto BACARPASS_SERVICE_ACCOUNT_JSON no tiene un JSON válido."
      );
    }

    if (!admin.apps.some((a) => (a as admin.app.App).name === "bacarpass")) {
      admin.initializeApp(
        {
          credential: admin.credential.cert(cred),
        },
        "bacarpass"
      );
    }

    const bacarDb = admin.app("bacarpass").firestore();
    const snapshot = await getBacarPassCollection(bacarDb).get();

    const list: BacarPassCredentialResponse[] = [];
    snapshot.forEach((doc) => {
      const d = doc.data() as BacarPassDoc;
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
  }
);
