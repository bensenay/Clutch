# Clutch App — Specification Audit and Implementation Report

Date: September 10, 2026

Source specification reviewed in full: `../scripts/hockey-coach-app-spec.md` (739 lines)

## Outcome

The repository was audited end to end against the hockey coach app specification. Missing v1 product flows were implemented, defects found during the audit were corrected, security boundaries were tightened, the visual system was refined, and the project was upgraded from Expo SDK 54 to the repository-required Expo SDK 57.

The application now passes TypeScript validation, Expo dependency validation, all 21 Expo Doctor checks, JSON/i18n consistency checks, whitespace validation, and production JavaScript bundling for both iOS and Android.

## Implemented and corrected

### Roles, onboarding, and organizations

- Added a working Super Admin moderation screen that lists real organizations, shows status and workspace totals, and supports confirmed suspend/reactivate actions.
- Added Director team creation, including the required first-team empty-state path and automatic activation of the newly created team.
- Added Director coach membership management for both team-level and organization-level removal. Removing access also cancels affected assistant assignments transactionally.
- Added existing-team discovery to organization onboarding. A coach can validate an organization code, choose an existing team, or type a new team name.
- Made existing-team matching case-insensitive to prevent accidental duplicate selection behavior.
- Preserved Director names from signup metadata through profile creation and delayed email-confirmation onboarding.
- Fixed delayed onboarding recovery so an intent is saved before signup, bound to the intended email, and cannot be applied to a different account on the same device.
- Added persistent Supabase sessions using React Native AsyncStorage, native URL polyfills, and foreground/background token-refresh handling.

### Authorization and data security

- Removed obsolete anonymous table grants.
- Hardened team-membership inserts so a Director cannot attach a user from another school by knowing their UUID.
- Added a protected Director-only membership-removal RPC with same-school validation.
- Tightened assignment creation so the target must hold an assistant membership on the assigned team.
- Added a database trigger that prevents assistants from changing Director-controlled assignment fields while still allowing their note/status workflow.
- Updated assignment access helpers so a removed assistant membership immediately removes corresponding game/practice access.
- Added a school-scoped drill-library RPC that safely returns creator and team display metadata without broadening profile visibility.
- Hid team-branding editing from read-only assistant contexts.

### Game Day

- Completed the structured template required by the specification:
  - opponent scouting notes;
  - players to watch;
  - key reminders;
  - post-game summary;
  - what worked;
  - what to fix.
- Included all structured fields in game persistence, offline records, editing, and PDF export.
- Added confirmed game deletion; saved lineups are removed through the existing database cascade.
- Added inactive/injured/suspended warnings when selecting a starting goalie, matching the existing skater override behavior.
- Fixed stale calendar data by invalidating the actual calendar query keys after game saves/deletes.
- Fixed an extra nested selector container that distorted the game result layout.
- Fixed saved-lineup cache invalidation after lineup changes.

### Drill designer and library

- Completed the object toolset with:
  - skate-path and pass-line styles: straight, curved, backward, and freehand;
  - player labels: F1, F2, F3, D1, D2, C, and G;
  - single/group puck and cone variants;
  - object rotation, duplication, and deletion;
  - undo and redo history;
  - color editing, text labels, shaded zones, and structured save/load compatibility.
- Added drill descriptions throughout create/edit, team library, school library, duplication, and practice linking.
- Added school-library search by drill name, creator, and team, plus visible creator/team metadata.
- Kept published drills read-only outside their owning team and duplicated them into the active team for editing.
- Added backward-compatible normalization for drills saved with the earlier canvas format.

### Practices and offline behavior

- Added gesture-based segment reordering with accessible up/down controls retained as a precise fallback.
- Added confirmed practice-plan deletion.
- Added offline caching and fallback for practice lists and practice detail, extending the existing roster/game/lineup/drill read cache.
- Fixed calendar invalidation after practice saves/deletes.

### Interface and product polish

- Applied the specification's exact core palette and app name.
- Added a restrained red header rule, consistent card depth, clearer hierarchy, and a dark native launch/background treatment.
- Reworked secondary buttons to be neutral and reserved solid red for primary/destructive actions, reducing visual noise.
- Added polished dashboard counts, status treatments, empty-state actions, searchable library controls, and role-appropriate actions.
- Kept all new interface copy fully translated in English and French. Both locale trees contain the same 751 terminal keys, and every static translation reference resolves.
- Kept iPad support enabled as specified without claiming tablet-specific layouts, which remain a documented backlog item.

### Platform maintenance

- Upgraded Expo from SDK 54 to SDK 57 and aligned React, React Native, native Expo modules, Reanimated, Gesture Handler, Worklets, SVG, TypeScript, and React types to Expo's required versions.
- Added `npm run typecheck` and `npm run doctor` maintenance commands.
- Applied all available non-breaking npm audit fixes. This removed the one high-severity transitive advisory.

## Database and backend deployment required

The code is implemented locally, but backend changes must be deployed to the target Supabase project before the new flows are exercised:

1. Apply these migrations in order:
   - `20260910120000_profile_names_and_security_hardening.sql`
   - `20260910130000_structured_game_notes.sql`
   - `20260910140000_director_membership_management.sql`
   - `20260910150000_membership_policy_hardening.sql`
2. Deploy the updated Edge Functions:
   - `create-organization`
   - `join-organization`
3. Run a role matrix smoke test with separate Super Admin, Director, head-coach, and assistant-coach accounts against the deployed project.

No remote database migrations or function deployments were performed from this workspace.

## Verification performed

- `npm run typecheck` — passed with no TypeScript errors.
- `npx expo install --check` — dependencies aligned with SDK 57.
- `npx expo-doctor` — 21/21 checks passed.
- iOS production export — passed; 1,973 modules bundled.
- Android production export — passed; 1,969 modules bundled.
- `git diff --check` — passed.
- `app.json`, `en.json`, and `fr.json` parsing — passed.
- English/French key parity — passed, 751 keys in each locale.
- Static translation-reference resolution — passed.
- `npm ls --depth=0` — dependency tree resolves without missing packages.

Physical-device interaction, live Supabase RLS behavior, email delivery, and native App Store archive signing cannot be verified solely from this local repository and should be included in pre-release QA.

## Deliberately not implemented

The subscription system in section 5.7 remains unimplemented because the specification explicitly marks it “designed, not yet built,” leaves product decisions unresolved, and identifies material App Store review risk. Implementing a guessed paywall or payment model would contradict the specification. The free-v1 path remains intact.

The following are also explicitly v1.1/backlog items and were not added: automatic lineups, drill animation/sequencing, parent/player accounts, push notifications, multi-school accounts, full offline write synchronization, player history/trends, tablet-specific layouts, and a web app.

## Pre-launch items requiring owner action

- Verify an owned sending domain in Resend/custom SMTP and use it for real coach emails.
- Re-enable Supabase email confirmation for production.
- Obtain a real privacy policy and legal/data-handling review for minors' contact and medical information.
- Choose and register the final iOS bundle identifier and Android application ID. No ownership-dependent identifier was guessed in this change.
- Prepare screenshots, store description, privacy disclosures, signing credentials, TestFlight testing, and App Store review submission.
- Review the remaining 18 moderate npm audit findings periodically. They are transitive React Navigation/Expo build-tool advisories; npm's only proposed automated remediation is an incompatible forced downgrade, so `npm audit fix --force` was intentionally not used.

## Recommended release sequence

1. Deploy the four migrations and two Edge Functions to a staging Supabase project.
2. Execute the four-role access matrix, including coach removal and assistant assignment revocation.
3. Test onboarding with email confirmation enabled, including app termination between signup and confirmation.
4. Test the drill canvas and practice segment gestures on at least one physical iPhone and one Android device.
5. Verify PDF sharing, image selection/logo upload, offline read fallback, and French layouts.
6. Complete privacy/email/store configuration, then produce signed TestFlight and internal Android builds.
