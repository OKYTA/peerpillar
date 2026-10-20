# PeerPillar refinement — 17 October 2026

This is a prepared source update. It has NOT been deployed. Production access returned 403 and no authenticated Vercel CLI was available.

## Implemented

- International Programs track: summer schools, research, exchanges and competitions.
- Multi-select tracks, motivations, application stages and next steps, with Select all / Clear all.
- Separate IELTS and SAT scores, persistence and a roadmap for every selected track; study hours divided across tracks.
- Shorter onboarding copy, animated orbital illustration, reduced-motion support.
- Google account entry before onboarding. Student / Mentor / Admin selected at entry; role is persisted once and checked server-side, with no in-app switch. Admin registration requires an allowlisted verified email.
- OAuth authorization code flow with PKCE and a short-lived signed state cookie. Google verifies the email. Signed, expiring HttpOnly sessions use the persistent account identity.
- Email delivery adapter for plan saves, booking confirmations/cancellations and submission receipts. Delivery failures remain visible in the workspace. No email was sent during development.

## Data model

- `workspaces/{userId}.json` holds only personal data: profile, roadmap progress, tasks and saved opportunities.
- `shared.json` holds everything two accounts must see together: mentor profiles and availability, bookings, reviews, support requests and each user's notifications. Writes use the Blob etag and retry, so simultaneous bookings do not overwrite each other. It is a single document: move it to a database before it grows past a few hundred records.
- Mentors list themselves from the Mentor desk. There are no built-in sample mentors, so Find a mentor stays empty until a mentor creates a profile.
- Attachments stay under their uploader's folder. `/api/file` serves them to the owner and to the student/mentor of the review they are attached to; Admins never receive learner work.
- `npm test` runs an end-to-end Student / Mentor / Admin flow against the route handlers with Blob and cookies mocked in memory (no network, no extra dependencies).

## Required production configuration

Set these in the existing PeerPillar Vercel project's server-side environment settings:

- APP_URL=https://peerpillar.vercel.app (no trailing slash)
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from a Google Cloud OAuth Web application.
- Register exactly https://peerpillar.vercel.app/api/auth/callback as an authorized redirect URI. Configure the Google consent screen and audience before public use.
- SESSION_SECRET: retain a strong server-only signing secret.
- BLOB_READ_WRITE_TOKEN: retain the existing private Blob store connection.
- ADMIN_EMAILS: comma-separated approved administrator emails. There is no default admin.
- RESEND_API_KEY and EMAIL_FROM: a verified sender/domain in Resend. Unconfigured delivery is reported, not simulated.

Never commit production secrets. Set environment variables in Vercel and redeploy the same project. Do not replace the project, domain, or existing Blob store.

## Validation

`npm ci` then `npm run build`.

Production build and TypeScript passed on October 16, 2026. 25 local integration assertions passed for multi-track persistence, validation, roadmap length, authorization, cookie tampering/expiry, OAuth state/PKCE, verified emails, immutable account roles and admin restrictions. Google and Blob were mocked; this is not evidence of live provider operation. Browser visual QA was not performed.

## Remaining platform limitations

The retained mentorship directory contains sample profiles and the retained booking/review data is scoped to individual workspaces. This update does not turn those sample mentors into real registered accounts or implement a shared mentor/student inbox. Real cross-account mentor routing, credential verification and complete marketplace workflows remain a separate backend task. Real payments are not collected.

Existing anonymous demo workspaces are not automatically merged into Google accounts. Google sign-in, real delivery and production access must be tested after the required configuration and deployment.

## Refinement in this package

- University Admissions wording throughout, with compatibility for saved Admissions records.
- Four tracks supported in the review flow, including an explicitly labelled sample International Programs mentor.
- Sample session prices start at $20 and vary by mentor. New bookings store their server-selected price and 20% platform rate; settlement totals use those snapshots. Existing demo bookings retain their historical pricing.
- Shorter interface copy, mobile layout fixes, accessible selection focus and existing reduced-motion animation support.
- Removed directions to switch roles after registration.

## Validation for this refinement

Production build and TypeScript passed. Data checks passed for all four tracks, 16-step multi-track roadmaps, legacy track migration, minimum prices, variable settlement and historical totals. Mocked route tests passed for server-owned pricing, program reviews and role restrictions. No live provider credentials were used or emails sent. Browser visual QA was unavailable in this environment.

Deployment remains blocked: the current Vercel connector returns 403 for the existing peerpillar project and no Vercel CLI is installed. This package has not replaced the live site. OAuth, email delivery, shared mentor routing and payments retain the limitations described above.
