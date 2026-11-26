# Firebase Spark + GitHub Pages setup

1. Create a Firebase project at https://console.firebase.google.com/ on the Spark (no-cost) plan.
2. Project settings → General → Your apps → Add web app. Copy the Firebase web configuration values into firebase-config.js (replace REPLACE_ values).
3. Firestore Database → Create database, choose production mode. Open Rules and paste firestore.rules, then Publish.
4. In GitHub repository Settings → Pages → Build and deployment → Source choose GitHub Actions. The included .github/workflows/pages.yml deploys root files on every push to main.
5. Expected Pages URL: https://officeaccxyz-source.github.io/bahadur/ (after Pages enabled and workflow finishes).

Firebase project creation and web app config require your own logged-in console action; no private keys are needed or committed. Keep Spark free plan. The public form has basic validation rules, but production spam protection (App Check/CAPTCHA or rate limiting) is recommended before launch.

## Appointment request workflow

The public appointment wizard writes requests to the Firestore `appointmentRequests` collection. Requests are stored with `status: "pending"`; they are not automatically confirmed or checked against a live calendar. The shop team must review requests in Firebase Console → Firestore Database → appointmentRequests and contact the client to confirm the slot.

Publish the updated `firestore.rules` in Firebase Console after deploying. The rules allow public create-only requests and deny public reads, edits and deletes. Before a production launch, add Firebase App Check / CAPTCHA and a trusted admin workflow. To enable real-time available-slot selection, double-booking prevention, automatic confirmations and Google Calendar sync, connect a scheduling provider or deploy a trusted server-side booking function; do not expose admin credentials in the static site.
