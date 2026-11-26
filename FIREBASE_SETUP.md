# Bahadu Bespoke — Firebase appointment calendar

## Architecture

- Firebase callable Cloud Functions run in `asia-southeast1`.
- The atelier timezone is fixed to `Asia/Yangon` (UTC+06:30).
- Default appointment hours are Monday–Saturday, 09:00–17:00, in 60-minute slots. Sunday is closed. The last start time is 16:00. A two-hour minimum lead time and 90-day booking horizon are enforced server-side.
- Every slot is represented by one Firestore `slotLocks/{YYYY-MM-DD_HHmm}` document. A Firestore transaction atomically checks and creates the lock with the appointment, so two customers cannot reserve the same slot simultaneously.
- New requests are `pending` and hold the slot for 24 hours. If not confirmed, the lock is treated as expired and becomes bookable again. Admin confirmation makes the lock permanent; cancellation releases it.
- Public users can call only the availability and create-booking functions. Admin functions require the Firebase Auth custom claim `admin: true`.
- `/admin.html` is a staff dashboard. It is not linked in the public navigation. Keep the admin URL private and grant claims only to trusted staff.

## One-time Firebase setup (required)

1. **Upgrade billing:** deployable Cloud Functions (2nd gen) require the Firebase project to be on the Blaze billing plan. Set budget alerts in Google Cloud Billing. Firestore usage, function invocations and email delivery may incur charges.
2. Enable **Cloud Firestore** and **Authentication → Sign-in method → Email/Password** in Firebase Console.
3. Create at least one staff user under Authentication → Users. Do not create a public staff sign-up page.
4. Replace Firestore Rules with the repository's `firestore.rules` and Publish. Client writes to appointments, slot locks and mail are denied; admin reads require the custom claim.
5. Install Node.js 20 and Firebase CLI. In the repository root run:
   ```sh
   npm install -g firebase-tools
   firebase login
   firebase use bahadur-9189b
   cd functions && npm install && cd ..
   firebase deploy --only functions,firestore:rules
   ```
   If Firebase CLI asks for a project alias, select `bahadur-9189b`.
6. **Grant admin access** using a service account with Firebase Authentication Admin privileges. Download its JSON key securely outside the repository, then:
   ```sh
   cd functions
   GOOGLE_APPLICATION_CREDENTIALS="/secure/path/service-account.json" FIREBASE_PROJECT_ID="bahadur-9189b" node scripts/set-admin-claim.js STAFF_USER_UID
   ```
   Replace `STAFF_USER_UID` with the exact UID shown in Firebase Authentication. Never commit the service-account key. Ask the staff member to sign out and back in after the claim is set.
7. Open `https://officeaccxyz-source.github.io/bahadur/admin.html`, sign in as the authorised staff user, and confirm/cancel requests from the dashboard.
8. To send confirmation emails automatically, install the official **Trigger Email** Firebase Extension and configure SMTP. Set its collection to `mail`. The confirmation function writes an email to that collection. Without the extension and valid SMTP settings, the dashboard still updates appointment status but no email is sent.
9. Enable Firebase **App Check** for the web app and enforce it on callable functions after registering the site and testing the token flow. Add reCAPTCHA Enterprise or an appropriate App Check provider before public launch.

## Test checklist

- Open the public appointment form, select a date and verify only available Yangon-time slots appear.
- Submit two booking requests for the same date/time from separate sessions; exactly one should succeed.
- Confirm the winning request in `/admin.html`; verify it remains unavailable and the status becomes confirmed.
- Cancel a pending request; verify the slot becomes available again.
- Let a pending hold expire (24 hours) or manually test with the emulator; verify the slot can be booked again.
- Test a Sunday, a past date, a date more than 90 days ahead, and a time within the two-hour lead window; the server must reject them.

## Business configuration

Opening days and hours are safe defaults in `functions/index.js`: Monday–Saturday, 09:00–17:00 Yangon time. Confirm actual atelier hours before launch and update `OPEN_HOUR`, `CLOSE_HOUR`, and the Sunday rule if needed. All appointment modes share the same staff capacity and slot lock. This first version books one slot per request; group tailoring is recorded as a party-size enquiry but does not automatically reserve multiple staff/slots.

## Important

The website is static GitHub Pages, but the booking logic and privileged actions run server-side. Never put service-account credentials or admin privileges in browser code. Appointment confirmation is manual from the dashboard; email delivery is automatic only after the Trigger Email extension and SMTP are configured.
