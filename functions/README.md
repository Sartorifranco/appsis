# Cloud Functions – IT Ops Hub

## getBacarPassCredentials

Función callable que devuelve las credenciales de BacarPass desde el proyecto **legajosonline-959f6** (Firestore: `artifacts/bacarpass-v1/public/data/passwords`). Solo usuarios **autenticados** con Firebase Auth en el IT Ops Hub pueden llamarla.

### Configuración del secreto

La función usa el secreto **BACARPASS_SERVICE_ACCOUNT_JSON** (contenido del JSON de la Service Account de legajosonline-959f6).

1. Crear el secreto en Google Cloud Secret Manager (mismo proyecto donde despliegas las functions):

   ```bash
   # Desde la raíz del proyecto, con el JSON en secrets/
   gcloud secrets create BACARPASS_SERVICE_ACCOUNT_JSON --data-file=secrets/legajosonline-959f6-firebase-adminsdk-fbsvc-ebe8b1c8ea.json
   ```

2. Dar acceso a la cuenta de servicio de Cloud Functions al secreto (Firebase lo hace automáticamente si añades el secreto en `secrets: [bacarPassServiceAccount]`).

3. Desplegar:

   ```bash
   cd functions
   npm install
   npm run build
   firebase deploy --only functions
   ```

El archivo JSON de la Service Account debe permanecer en la carpeta `secrets/` (ya está en `.gitignore`) y **no subirse a GitHub**.
