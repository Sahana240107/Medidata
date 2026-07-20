// app/(dashboard)/cases/setup/page.jsx
//
// Route: /cases/setup
// Download + extract the CLI, then log in / connect MySQL / pick your
// doctor record — everything after the download happens in this page,
// talking to the local `medidata serve` process. See CliSetupWizard.jsx.
export { default } from "@/components/cases/CliSetupWizard";
