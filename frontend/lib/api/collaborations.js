import { apiFetch } from "./client";

/**
 * Collaboration requests (connect / collaborate / invite-to-study),
 * accept/decline, progress tracking, and the per-collaboration personal chat.
 */

export function listCollaborations(box = "active") {
  return apiFetch(`/collaborations?box=${box}`);
}

/**
 * kind: 'connect' | 'collaborate' | 'invite_to_study'
 */
export function createCollaboration({
  requestedTo,
  message = null,
  kind = "connect",
  relatedCaseId = null,
  relatedSignalId = null,
  projectTitle = null,
}) {
  return apiFetch(`/collaborations`, {
    method: "POST",
    body: {
      requested_to: requestedTo,
      message,
      kind,
      related_case_id: relatedCaseId,
      related_signal_id: relatedSignalId,
      project_title: projectTitle,
    },
  });
}

export function respondToCollaboration(collaborationId, action) {
  return apiFetch(`/collaborations/${collaborationId}/respond`, {
    method: "POST",
    body: { action },
  });
}

export function updateCollaborationProgress(collaborationId, progressPercent, projectTitle = null) {
  return apiFetch(`/collaborations/${collaborationId}/progress`, {
    method: "PATCH",
    body: { progress_percent: progressPercent, project_title: projectTitle },
  });
}

export function listMessages(collaborationId) {
  return apiFetch(`/collaborations/${collaborationId}/messages`);
}

export function sendMessage(collaborationId, content) {
  return apiFetch(`/collaborations/${collaborationId}/messages`, {
    method: "POST",
    body: { content },
  });
}