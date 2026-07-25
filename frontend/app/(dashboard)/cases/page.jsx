// app/(dashboard)/cases/page.jsx
//
// Route: /cases ("New Case" in the sidebar)
// This route itself has no UI — it just sends you to whichever of the two
// CLI-frontend pages is relevant: /cases/setup (first time / local CLI
// server not fully configured yet) or /cases/submit (once it's set up and
// ready to fetch + submit cases). See CliSetupWizard.jsx and
// CaseSubmission.jsx for the actual pages.
export { default } from "@/components/cases/CasesEntry";
