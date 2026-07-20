// app/(dashboard)/cases/submit/page.jsx
//
// Route: /cases/submit ("New Case" in the sidebar)
// "Submit New Cases" -> local CLI fetches + anonymizes new records for
// this doctor -> review here -> Verify writes to Supabase + the search
// index (Qdrant), Discard leaves everything untouched. See CaseSubmission.jsx.
export { default } from "@/components/cases/CaseSubmission";
