const API_BASE = "https://s7rnqlvpvfg4w6oq6epojtfrda0xeopq.lambda-url.us-east-1.on.aws";

let currentUser = null;
let currentLegacy = null;
let currentConversationId = null;
let onboardInvites = [];

function $(id) { return document.getElementById(id); }

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });

  let data = {};
  try { data = await response.json(); } catch { data = {}; }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function showAuthError(type, message) {
  const element = type === "login" ? $("loginError") : $("signupError");
  if (element) element.textContent = message || "";
}

function clearAuthErrors() {
  showAuthError("login", "");
  showAuthError("signup", "");
}

function showLoginView() {
  $("loginView")?.classList.remove("hidden");
  $("signupView")?.classList.add("hidden");
  clearAuthErrors();
}

function showSignupView() {
  $("loginView")?.classList.add("hidden");
  $("signupView")?.classList.remove("hidden");
  clearAuthErrors();
}

async function handleSignup(event) {
  event.preventDefault();
  clearAuthErrors();

  const displayName = $("signupName")?.value.trim();
  const email = $("signupEmail")?.value.trim();
  const password = $("signupPassword")?.value;

  if (!displayName || !email || !password) {
    showAuthError("signup", "Please complete all fields.");
    return;
  }

  if (password.length < 8) {
    showAuthError("signup", "Password must be at least 8 characters.");
    return;
  }

  const button = $("signupForm")?.querySelector("button[type='submit']");

  try {
    if (button) { button.disabled = true; button.textContent = "Creating..."; }

    const data = await apiRequest("/signup", {
      method: "POST",
      body: JSON.stringify({ email, displayName, password }),
    });

    currentUser = data.user;
    currentLegacy = data.legacy;

    localStorage.setItem("stillWithYouUser", JSON.stringify(currentUser));
    localStorage.setItem("stillWithYouLegacy", JSON.stringify(currentLegacy));

    $("signupForm")?.reset();
    openInviteOnboarding();

  } catch (error) {
    console.error("Signup error:", error);
    showAuthError("signup", error.message || "Unable to create account.");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Create account"; }
  }
}

async function handleLogin(event) {
  event.preventDefault();
  clearAuthErrors();

  const email = $("loginEmail")?.value.trim();
  const password = $("loginPassword")?.value;

  if (!email || !password) {
    showAuthError("login", "Please enter your email and password.");
    return;
  }

  const button = $("loginForm")?.querySelector("button[type='submit']");

  try {
    if (button) { button.disabled = true; button.textContent = "Signing in..."; }

    const data = await apiRequest("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    currentUser = data.user;
    localStorage.setItem("stillWithYouUser", JSON.stringify(currentUser));

    await loadLegacy();

    $("loginForm")?.reset();
    openDashboard();

  } catch (error) {
    console.error("Login error:", error);
    showAuthError("login", error.message || "Invalid email or password.");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Continue"; }
  }
}

async function loadLegacy() {
  if (!currentUser?.id) throw new Error("User ID is missing.");

  const data = await apiRequest(`/legacy?userId=${encodeURIComponent(currentUser.id)}`);
  currentLegacy = data.legacy;

  localStorage.setItem("stillWithYouLegacy", JSON.stringify(currentLegacy));
  return currentLegacy;
}

function isOwner() {
  return currentLegacy?.owner_user_id === currentUser?.id;
}

function openInviteOnboarding() {
  onboardInvites = [];
  $("authScreen")?.classList.add("hidden");
  $("inviteScreen")?.classList.remove("hidden");
  const errEl = $("inviteOnboardError");
  if (errEl) errEl.textContent = "";
  renderOnboardInviteList();

  const heading = $("inviteHeading");
  if (heading && currentUser?.display_name) {
    heading.textContent = `Who should reach ${currentUser.display_name} here?`;
  }
}

function renderOnboardInviteList() {
  const list = $("inviteOnboardList");
  if (!list) return;

  if (onboardInvites.length === 0) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = onboardInvites.map((invite) => `
    <div class="member-row">
      <div class="member-info">
        <div class="member-name">${escapeHtml(invite.email)}</div>
      </div>
      <div class="member-tags">
        <span class="tag tag-relationship">${escapeHtml(invite.relationshipType)}</span>
      </div>
    </div>
  `).join("");
}

async function handleOnboardInvite(event) {
  event.preventDefault();

  const errorEl = $("inviteOnboardError");
  if (errorEl) errorEl.textContent = "";

  const email = $("inviteOnboardEmail")?.value.trim();
  const relationshipType = $("inviteOnboardRelationship")?.value.trim();

  if (!email || !relationshipType) {
    if (errorEl) errorEl.textContent = "Please enter both an email and a relationship.";
    return;
  }

  const button = $("inviteOnboardForm")?.querySelector("button[type='submit']");

  try {
    if (button) { button.disabled = true; button.textContent = "Adding..."; }

    await apiRequest("/legacy/invites", {
      method: "POST",
      body: JSON.stringify({
        legacyId: currentLegacy.id,
        ownerUserId: currentUser.id,
        email,
        relationshipType,
      }),
    });

    onboardInvites.push({ email, relationshipType });
    renderOnboardInviteList();
    $("inviteOnboardForm")?.reset();

  } catch (error) {
    console.error("Onboard invite error:", error);
    if (errorEl) errorEl.textContent = error.message || "Unable to add this person.";
  } finally {
    if (button) { button.disabled = false; button.textContent = "Add"; }
  }
}

function finishInviteOnboarding() {
  $("inviteScreen")?.classList.add("hidden");
  openDashboard();
}

function openDashboard() {
  $("authScreen")?.classList.add("hidden");
  $("inviteScreen")?.classList.add("hidden");
  $("settingsScreen")?.classList.add("hidden");
  $("dashboardScreen")?.classList.remove("hidden");
  setActiveNav("navChat");
  updateLegacyUI();
}

function updateLegacyUI() {
  if (!currentLegacy) return;

  const legacyName =
    currentLegacy.display_name ||
    currentLegacy.displayName ||
    "Your Legacy";

  // Main sidebar identity
  const legacyNameDisplay = $("legacyNameDisplay");

  if (legacyNameDisplay) {
    legacyNameDisplay.textContent = legacyName;
  }

  // Generate initials
  const initials = legacyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "SL";

  // Sidebar avatar
  const avatar = $("legacyAvatar");

  if (avatar) {
    avatar.textContent = initials;
  }

  // Topbar avatar
  const topbarAvatar = $("topbarAvatar");

  if (topbarAvatar) {
    topbarAvatar.textContent = initials.charAt(0);
  }

  // Right-side identity avatar
  const panelAvatar = $("panelLegacyAvatar");

  if (panelAvatar) {
    panelAvatar.textContent = initials;
  }

  // Topbar legacy name
  const topbarLegacyName = $("topbarLegacyName");

  if (topbarLegacyName) {
    topbarLegacyName.textContent = legacyName;
  }

  // Chat card legacy name
  const chatLegacyName = $("chatLegacyName");

  if (chatLegacyName) {
    chatLegacyName.textContent = legacyName;
  }

  // Right panel legacy name
  const panelLegacyName = $("panelLegacyName");

  if (panelLegacyName) {
    panelLegacyName.textContent = legacyName;
  }

  // Relationship badge
  const badge = $("relationshipBadge");

  if (badge) {

    if (!isOwner() && currentLegacy.relationship_type) {

      badge.textContent = currentLegacy.relationship_type;

      badge.classList.remove("hidden");

    } else {

      badge.classList.add("hidden");

    }
  }

  updateConversationCopy(legacyName);

  loadMemoryHighlight();
}

// ==================================================
// PERSONALIZED HEADING / SUBHEADING
// ==================================================

const RELATIONSHIP_SUBHEADINGS = {
  default: [
    "You haven't lost them. What they shared with you is still here, waiting.",
    "Some voices don't go quiet. They just wait for you to ask.",
    "Everything remembered here is real — nothing here is invented.",
  ],
  daughter: [
    "The advice she gave you didn't leave with her. It's still here.",
    "A mother's words have a way of staying. So does this.",
  ],
  son: [
    "The things he always said to you are still worth asking about.",
    "What he taught you didn't end. Ask him anything.",
  ],
  husband: [
    "The little things he'd say, the way he'd say them — still here.",
    "You shared a whole life together. Come talk about it.",
  ],
  wife: [
    "The little things she'd say, the way she'd say them — still here.",
    "You shared a whole life together. Come talk about it.",
  ],
};

function updateConversationCopy(legacyName) {
  const heading = $("conversationHeading");
  const subheading = $("conversationSubheading");

  if (isOwner()) {
    if (heading) heading.innerHTML = "A place to talk, <em>remember</em>, and reflect.";
    if (subheading) {
      subheading.textContent =
        "Share what you'd want them to know. Every word here becomes part of what's kept.";
    }
    return;
  }

  const relationship = (currentLegacy.relationship_type || "").toLowerCase();

  if (heading) {
    heading.innerHTML = `Still talking with <em>${escapeHtml(legacyName)}</em>.`;
  }

  if (subheading) {
    const pool = RELATIONSHIP_SUBHEADINGS[relationship] || RELATIONSHIP_SUBHEADINGS.default;
    const line = pool[Math.floor(Math.random() * pool.length)];
    subheading.textContent = line;
  }
}

// ==================================================
// FEATURED MEMORY
// ==================================================

async function loadMemoryHighlight() {
  const card = $("memoryHighlight");

  if (card) {
    card.classList.add("hidden");
  }
}

function setActiveNav(id) {
  ["navChat", "navSettings"].forEach((navId) => {
    $(navId)?.classList.toggle("active", navId === id);
  });
}

function openSettings() {
  $("dashboardScreen")?.classList.add("hidden");
  $("settingsScreen")?.classList.remove("hidden");
  setActiveNav("navSettings");
  loadMembers();
  loadInvites();

  const inviteSection = $("inviteMemberSection");
  if (inviteSection) inviteSection.classList.toggle("hidden", !isOwner());
}

function closeSettings() {
  $("settingsScreen")?.classList.add("hidden");
  $("dashboardScreen")?.classList.remove("hidden");
  setActiveNav("navChat");
}

async function loadMembers() {
  const list = $("memberList");
  if (!list || !currentLegacy?.id) return;

  list.innerHTML = `<div class="settings-note">Loading...</div>`;

  try {
    const data = await apiRequest(`/legacy/members?legacyId=${encodeURIComponent(currentLegacy.id)}`);
    renderMembers(data.members || []);
  } catch (error) {
    console.error("Load members error:", error);
    list.innerHTML = `<div class="settings-note">Unable to load family members right now.</div>`;
  }
}

function renderMembers(members) {
  const list = $("memberList");
  if (!list) return;

  if (members.length === 0) {
    list.innerHTML = `<div class="settings-note">No one has access yet.</div>`;
    return;
  }

  list.innerHTML = members.map((member) => {
    const isMemberOwner = member.access_level === "owner";

    const tags = [
      isMemberOwner
        ? `<span class="tag tag-owner">Owner</span>`
        : `<span class="tag tag-owner">${escapeHtml(member.access_level || "member")}</span>`,
      member.relationship_type
        ? `<span class="tag tag-relationship">${escapeHtml(member.relationship_type)}</span>`
        : "",
    ].join("");

    return `
      <div class="member-row">
        <div class="member-info">
          <div class="member-name">${escapeHtml(member.display_name || "Unnamed")}</div>
          <div class="member-email">${escapeHtml(member.email || "")}</div>
        </div>
        <div class="member-tags">${tags}</div>
      </div>
    `;
  }).join("");
}

async function loadInvites() {
  const list = $("inviteList");
  if (!list || !currentLegacy?.id) return;

  list.innerHTML = `<div class="settings-note">Loading...</div>`;

  try {
    const data = await apiRequest(`/legacy/invites?legacyId=${encodeURIComponent(currentLegacy.id)}`);
    renderInvites(data.invites || []);
  } catch (error) {
    console.error("Load invites error:", error);
    list.innerHTML = `<div class="settings-note">Unable to load invites right now.</div>`;
  }
}

function renderInvites(invites) {
  const list = $("inviteList");
  if (!list) return;

  const pending = invites.filter((invite) => invite.status === "pending");

  if (pending.length === 0) {
    list.innerHTML = `<div class="settings-note">No pending invites.</div>`;
    return;
  }

  list.innerHTML = pending.map((invite) => `
    <div class="member-row">
      <div class="member-info">
        <div class="member-name">${escapeHtml(invite.email)}</div>
        <div class="member-email">Waiting for them to sign up</div>
      </div>
      <div class="member-tags">
        <span class="tag tag-relationship">${escapeHtml(invite.relationship_type)}</span>
      </div>
    </div>
  `).join("");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

async function handleInviteMember(event) {
  event.preventDefault();

  const errorEl = $("inviteMemberError");
  const successEl = $("inviteMemberSuccess");
  if (errorEl) errorEl.textContent = "";
  if (successEl) successEl.textContent = "";

  const relationshipType = $("inviteRelationship")?.value.trim();
  const email = $("inviteEmail")?.value.trim();

  if (!relationshipType || !email) {
    if (errorEl) errorEl.textContent = "Please complete all fields.";
    return;
  }

  const button = $("inviteMemberForm")?.querySelector("button[type='submit']");

  try {
    if (button) { button.disabled = true; button.textContent = "Adding..."; }

    const result = await apiRequest("/legacy/invites", {
      method: "POST",
      body: JSON.stringify({
        legacyId: currentLegacy.id,
        ownerUserId: currentUser.id,
        email,
        relationshipType,
      }),
    });

    if (successEl) {
      successEl.textContent =
        result.status === "linked_existing_account"
          ? `${email} already has an account and now has access.`
          : `${email} has been invited. They'll get access as soon as they sign up.`;
    }

    $("inviteMemberForm")?.reset();
    loadMembers();
    loadInvites();

  } catch (error) {
    console.error("Invite member error:", error);
    if (errorEl) errorEl.textContent = error.message || "Unable to add this person.";
  } finally {
    if (button) { button.disabled = false; button.textContent = "Invite"; }
  }
}

async function sendMessage(messageOverride = null) {
  const input = $("messageInput");
  if (!input) return;

  const message = messageOverride !== null ? messageOverride.trim() : input.value.trim();
  if (!message) return;

  if (!currentUser?.id) { appendMessage("Still With You", "Please sign in first."); return; }
  if (!currentLegacy?.id) { appendMessage("Still With You", "I couldn't find your Legacy."); return; }

  appendMessage("You", message);
  input.value = "";
  updateCharacterCount();
  setChatLoading(true);

  try {
    const data = await apiRequest("/chat", {
      method: "POST",
      body: JSON.stringify({
        legacyId: currentLegacy.id,
        userId: currentUser.id,
        conversationId: currentConversationId,
        message,
      }),
    });

    currentConversationId = data.conversationId;

    const senderLabel = data.isOwnerContribution
      ? "Still With You"
      : (currentLegacy.display_name || currentLegacy.displayName || "Still With You");

    appendMessage(
      senderLabel,
      data.response || "I don't have a response yet."
    );

  } catch (error) {
    console.error("Chat error:", error);
    appendMessage("Still With You", "I'm sorry, I couldn't process that conversation right now.");
  } finally {
    setChatLoading(false);
  }
}

function appendMessage(sender, text) {
  const messages = $("messages");
  if (!messages) return;

  $("emptyState")?.classList.add("hidden");

  const wrapper = document.createElement("div");
  wrapper.className = sender === "You" ? "message user-message" : "message";

  const senderEl = document.createElement("div");
  senderEl.className = "message-sender";
  senderEl.textContent = sender;

  const textEl = document.createElement("div");
  textEl.className = "message-text";
  textEl.textContent = text;

  const inner = document.createElement("div");
  inner.appendChild(senderEl);
  inner.appendChild(textEl);
  wrapper.appendChild(inner);

  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

function setChatLoading(isLoading) {
  const button = $("sendButton");
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? "…" : "↑";
}

function updateCharacterCount() {
  const input = $("messageInput");
  const counter = $("characterCount");
  if (!input || !counter) return;
  counter.textContent = input.value.length;
}

function setupSuggestions() {
  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.dataset.question;
      if (!question) return;
      const input = $("messageInput");
      if (input) { input.value = question; updateCharacterCount(); input.focus(); }
    });
  });
}

function logout() {
  currentUser = null;
  currentLegacy = null;
  currentConversationId = null;

  localStorage.removeItem("stillWithYouUser");
  localStorage.removeItem("stillWithYouLegacy");

  $("dashboardScreen")?.classList.add("hidden");
  $("settingsScreen")?.classList.add("hidden");
  $("inviteScreen")?.classList.add("hidden");
  $("authScreen")?.classList.remove("hidden");

  showLoginView();

  const messages = $("messages");
  if (messages) messages.innerHTML = "";
  $("emptyState")?.classList.remove("hidden");
}

async function restoreSession() {
  const storedUser = localStorage.getItem("stillWithYouUser");
  const storedLegacy = localStorage.getItem("stillWithYouLegacy");

  if (!storedUser) { showLoginView(); return; }

  try {
    currentUser = JSON.parse(storedUser);
    if (storedLegacy) currentLegacy = JSON.parse(storedLegacy);

    await loadLegacy();
    openDashboard();

  } catch (error) {
    console.error("Session restore failed:", error);
    currentUser = null;
    currentLegacy = null;
    localStorage.removeItem("stillWithYouUser");
    localStorage.removeItem("stillWithYouLegacy");
    showLoginView();
  }
}

function applyTimeOfDayTheme() {
  const hour = new Date().getHours();
  let band;

  if (hour >= 5 && hour < 11) band = "time-morning";
  else if (hour >= 11 && hour < 17) band = "time-midday";
  else if (hour >= 17 && hour < 21) band = "time-evening";
  else band = "time-night";

  document.body.classList.remove("time-morning", "time-midday", "time-evening", "time-night");
  document.body.classList.add(band);
}

document.addEventListener("DOMContentLoaded", () => {
  applyTimeOfDayTheme();

  $("loginForm")?.addEventListener("submit", handleLogin);
  $("signupForm")?.addEventListener("submit", handleSignup);
  $("showSignup")?.addEventListener("click", showSignupView);
  $("showLogin")?.addEventListener("click", showLoginView);

  $("inviteOnboardForm")?.addEventListener("submit", handleOnboardInvite);
  $("inviteOnboardContinue")?.addEventListener("click", finishInviteOnboarding);
  $("inviteOnboardSkip")?.addEventListener("click", finishInviteOnboarding);

  $("sendButton")?.addEventListener("click", () => sendMessage());
  $("messageInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); }
  });
  $("messageInput")?.addEventListener("input", updateCharacterCount);

  $("logoutButton")?.addEventListener("click", logout);

  $("navChat")?.addEventListener("click", closeSettings);
  $("navSettings")?.addEventListener("click", openSettings);
  $("settingsBack")?.addEventListener("click", closeSettings);

  $("inviteMemberForm")?.addEventListener("submit", handleInviteMember);

  setupSuggestions();
  restoreSession();
});


// ==================================================
// PREMIUM DASHBOARD QUICK PROMPTS
// ==================================================

document.addEventListener("click", (event) => {

  const chip = event.target.closest(".prompt-chip");

  if (!chip) return;

  const prompt = chip.dataset.prompt;

  const input = $("messageInput");

  if (!input || !prompt) return;

  input.value = prompt;

  input.focus();

  input.dispatchEvent(new Event("input", { bubbles: true }));

});
