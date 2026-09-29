document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const participantActivitySelect = document.getElementById("participant-activity");
  const participantSummary = document.getElementById("participant-summary");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  let activities = {};

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatParticipantName(email) {
    return email
      .split("@")[0]
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function participantRowMarkup(participant, activityName) {
    return `
      <li class="participant-row">
        <div>
          <strong>${escapeHtml(formatParticipantName(participant))}</strong>
          <span class="participant-email">${escapeHtml(participant)}</span>
        </div>
        <button
          type="button"
          class="delete-participant"
          data-activity="${escapeHtml(activityName)}"
          data-email="${escapeHtml(participant)}"
          aria-label="Unregister ${escapeHtml(participant)} from ${escapeHtml(activityName)}"
          title="Unregister participant"
        >&#128465;</button>
      </li>`;
  }

  function renderParticipantSummary() {
    const activityName = participantActivitySelect.value;
    const activity = activities[activityName];

    if (!activity) {
      participantSummary.innerHTML =
        '<p class="overview-placeholder">Select a club to view its participants.</p>';
      return;
    }

    const participantCount = activity.participants.length;
    const countLabel = `${participantCount} participant${participantCount === 1 ? "" : "s"}`;
    const participants = participantCount
      ? `<ul class="overview-participant-list">
          ${activity.participants
            .map((participant) => participantRowMarkup(participant, activityName))
            .join("")}
        </ul>`
      : '<p class="no-participants">No participants yet</p>';

    participantSummary.innerHTML = `
      <div class="participant-summary-header">
        <h5>${escapeHtml(activityName)}</h5>
        <strong>${countLabel}</strong>
      </div>
      ${participants}`;
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities", { cache: "no-store" });
      activities = await response.json();
      const selectedParticipantActivity = participantActivitySelect.value;

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
      participantActivitySelect.innerHTML = '<option value="">-- Select a club --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        activityCard.innerHTML = `
          <h4>${escapeHtml(name)}</h4>
          <p>${escapeHtml(details.description)}</p>
          <p><strong>Schedule:</strong> ${escapeHtml(details.schedule)}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-section">
            <h5>Participants</h5>
            ${details.participants.length > 0
              ? `<ul>${details.participants.map((participant) => participantRowMarkup(participant, name)).join("")}</ul>`
              : "<p class=\"no-participants\">No participants yet</p>"}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);

        const participantOption = document.createElement("option");
        participantOption.value = name;
        participantOption.textContent = name;
        participantActivitySelect.appendChild(participantOption);
      });

      if (selectedParticipantActivity in activities) {
        participantActivitySelect.value = selectedParticipantActivity;
      }
      renderParticipantSummary();
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        await fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  async function handleParticipantDelete(event) {
    const deleteButton = event.target.closest(".delete-participant");
    if (!deleteButton) {
      return;
    }

    const activity = deleteButton.dataset.activity;
    const email = deleteButton.dataset.email;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/participants/${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.detail || "Unable to unregister participant");
      }

      await fetchActivities();
    } catch (error) {
      messageDiv.textContent = error.message;
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering participant:", error);
    }
  }

  activitiesList.addEventListener("click", handleParticipantDelete);
  participantSummary.addEventListener("click", handleParticipantDelete);
  participantActivitySelect.addEventListener("change", renderParticipantSummary);

  // Initialize app
  fetchActivities();
});
