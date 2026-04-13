(function () {
  const allowedRoutes = ["cards", "draft", "tasks", "feedback"];

  function byId(id) {
    return document.getElementById(id);
  }

  function card(label, value) {
    const safeValue = value === null || value === undefined || value === "" ? "-" : value;
    return (
      '<div class="meta-item">' +
      '<div class="meta-label">' +
      label +
      "</div>" +
      '<div class="meta-value">' +
      safeValue +
      "</div>" +
      "</div>"
    );
  }

  function toPayloadItems(payload) {
    if (!payload || typeof payload !== "object") {
      return [];
    }
    return Object.entries(payload).map(([key, value]) => ({
      key,
      value:
        value === null || value === undefined
          ? "-"
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value)
    }));
  }

  function defaultConfig(route) {
    switch (route) {
      case "cards":
        return {
          route: "cards",
          title: "Cards Route Page",
          subtitle: "View and verify card-entry readiness before stepping into card workspace.",
          primaryActionLabel: "Record Cards Action",
          primaryActionType: "go_cards"
        };
      case "draft":
        return {
          route: "draft",
          title: "Draft Route Page",
          subtitle: "Confirm draft workflow readiness and keep doctor-reviewed drafting in control.",
          primaryActionLabel: "Create Draft Stub",
          primaryActionType: "create_draft_stub"
        };
      case "tasks":
        return {
          route: "tasks",
          title: "Tasks Route Page",
          subtitle: "Inspect task readiness and log first task bootstrap action when needed.",
          primaryActionLabel: "Create Task Stub",
          primaryActionType: "create_task_stub"
        };
      case "feedback":
        return {
          route: "feedback",
          title: "Feedback Route Page",
          subtitle: "Check feedback readiness and record first feedback bootstrap action.",
          primaryActionLabel: "Create Feedback Stub",
          primaryActionType: "create_feedback_stub"
        };
      default:
        return {
          route: "cards",
          title: "Route Page",
          subtitle: "Route gateway.",
          primaryActionLabel: "Record Action",
          primaryActionType: "go_cards"
        };
    }
  }

  function initWorkspaceRoutePage(inputConfig) {
    const params = new URLSearchParams(window.location.search);
    const routeFromParam = params.get("route");
    const route = allowedRoutes.includes(routeFromParam)
      ? routeFromParam
      : inputConfig && allowedRoutes.includes(inputConfig.route)
        ? inputConfig.route
        : "cards";

    const config = {
      ...defaultConfig(route),
      ...(inputConfig || {}),
      route
    };

    const nodes = {
      title: byId("page-title"),
      subtitle: byId("page-subtitle"),
      clientId: byId("client-id"),
      scenario: byId("scenario"),
      tenantId: byId("tenant-id"),
      apiBase: byId("api-base"),
      routeLabel: byId("route-label"),
      refreshBtn: byId("refresh-btn"),
      backBtn: byId("back-btn"),
      actionBtn: byId("action-btn"),
      topSubtitle: byId("top-subtitle"),
      resultPill: byId("result-pill"),
      hintBanner: byId("hint-banner"),
      errorBanner: byId("error-banner"),
      summaryGrid: byId("summary-grid"),
      payloadList: byId("payload-list"),
      rawResponse: byId("raw-response")
    };

    nodes.title.textContent = config.title;
    nodes.subtitle.textContent = config.subtitle;
    nodes.actionBtn.textContent = config.primaryActionLabel;
    nodes.routeLabel.textContent = config.route;
    nodes.clientId.value = params.get("client_id") || "C_AUTO_001";
    nodes.scenario.value = params.get("scenario") || "auto";
    nodes.tenantId.value = params.get("tenant_id") || "00000000-0000-0000-0000-000000000001";
    nodes.apiBase.value = params.get("api_base") || window.location.origin + "/kb/v1";

    function setBanner(type, text) {
      if (type === "hint") {
        nodes.hintBanner.style.display = text ? "block" : "none";
        nodes.hintBanner.textContent = text || "";
        return;
      }
      nodes.errorBanner.style.display = text ? "block" : "none";
      nodes.errorBanner.textContent = text || "";
    }

    function setResultPill(status) {
      nodes.resultPill.className = "pill";
      if (status === "success") {
        nodes.resultPill.classList.add("pill-ok");
      } else if (status === "partial") {
        nodes.resultPill.classList.add("pill-warn");
      } else {
        nodes.resultPill.classList.add("pill-err");
      }
      nodes.resultPill.textContent = status;
    }

    function buildWorkspaceUrl() {
      const q = new URLSearchParams({
        client_id: nodes.clientId.value.trim() || "C_AUTO_001",
        scenario: nodes.scenario.value || "auto",
        tenant_id: nodes.tenantId.value.trim() || "00000000-0000-0000-0000-000000000001",
        api_base: nodes.apiBase.value.trim() || window.location.origin + "/kb/v1"
      });
      return "/client-workspace-page-v1/index.html?" + q.toString();
    }

    function syncUrl() {
      const q = new URLSearchParams({
        client_id: nodes.clientId.value.trim() || "C_AUTO_001",
        route: config.route,
        scenario: nodes.scenario.value || "auto",
        tenant_id: nodes.tenantId.value.trim() || "00000000-0000-0000-0000-000000000001",
        api_base: nodes.apiBase.value.trim() || window.location.origin + "/kb/v1"
      });
      window.history.replaceState({}, "", "?" + q.toString());
      nodes.backBtn.setAttribute("href", buildWorkspaceUrl());
    }

    async function postWorkspaceAction(actionType) {
      const clientId = nodes.clientId.value.trim() || "C_AUTO_001";
      const tenantId = nodes.tenantId.value.trim();
      const apiBase = nodes.apiBase.value.trim() || window.location.origin + "/kb/v1";
      const endpoint =
        apiBase.replace(/\/$/, "") + "/clients/" + encodeURIComponent(clientId) + "/workspace-actions";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-id": tenantId,
          "x-actor-id": "workspace_route_page",
          "x-actor-type": "doctor",
          "x-request-id": "workspace-route-ui-action-" + Date.now()
        },
        body: JSON.stringify({
          action_type: actionType,
          target_object_type: "workspace_route_page",
          target_object_id: config.route,
          metadata: {
            source: "route_page",
            route: config.route
          }
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error_hint || "workspace_action_log_failed");
      }

      return response.json().catch(() => ({}));
    }

    async function loadRoute() {
      syncUrl();
      setBanner("hint", "");
      setBanner("error", "");
      setResultPill("success");
      nodes.summaryGrid.innerHTML = card("Loading", "Fetching route summary...");
      nodes.payloadList.innerHTML = "";
      nodes.rawResponse.textContent = "";

      const clientId = nodes.clientId.value.trim() || "C_AUTO_001";
      const scenario = nodes.scenario.value || "auto";
      const tenantId = nodes.tenantId.value.trim();
      const apiBase = nodes.apiBase.value.trim() || window.location.origin + "/kb/v1";
      const endpoint =
        apiBase.replace(/\/$/, "") +
        "/clients/" +
        encodeURIComponent(clientId) +
        "/" +
        encodeURIComponent(config.route) +
        "?scenario=" +
        encodeURIComponent(scenario);

      try {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "x-tenant-id": tenantId,
            "x-actor-id": "workspace_route_page",
            "x-actor-type": "doctor",
            "x-request-id": "workspace-route-page-" + Date.now()
          }
        });
        const body = await response.json();
        nodes.rawResponse.textContent = JSON.stringify(body, null, 2);

        if (!response.ok || body.status === "failed") {
          throw new Error(body.error_hint || "workspace_route_failed");
        }

        const data = body.data || {};
        setResultPill(body.status || "success");
        nodes.topSubtitle.textContent =
          "Route " +
          (data.route || config.route) +
          " | route_ready=" +
          String(data.route_ready) +
          " | error_hint: " +
          (body.error_hint || "-");

        nodes.summaryGrid.innerHTML =
          card("Client ID", data.client_id || clientId) +
          card("Route", data.route || config.route) +
          card("Route Ready", String(data.route_ready)) +
          card("Route URL", data.route_url || "-") +
          card("Route Title", data.route_title || "-") +
          card("Route Summary", data.route_summary || "-");

        const payloadItems = toPayloadItems(data.route_payload);
        if (payloadItems.length === 0) {
          nodes.payloadList.innerHTML = '<li class="empty">No route payload.</li>';
        } else {
          nodes.payloadList.innerHTML = payloadItems
            .map((item) => {
              return (
                "<li><span class='payload-key'>" +
                item.key +
                "</span>" +
                item.value +
                "</li>"
              );
            })
            .join("");
        }

        if (body.status === "partial" || !data.route_ready) {
          setBanner(
            "hint",
            "Route is reachable but not fully ready yet. Continue from workspace and fill missing prerequisites."
          );
        }
      } catch (err) {
        setResultPill("failed");
        nodes.topSubtitle.textContent = "Route load failed";
        setBanner("error", "Route load failed: " + (err && err.message ? err.message : "unknown_error"));
        nodes.summaryGrid.innerHTML = card("Error", "Failed to load route summary.");
        nodes.payloadList.innerHTML = '<li class="empty">Data unavailable.</li>';
        if (!nodes.rawResponse.textContent) {
          nodes.rawResponse.textContent = "{}";
        }
      }
    }

    nodes.refreshBtn.addEventListener("click", loadRoute);
    nodes.backBtn.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = buildWorkspaceUrl();
    });
    nodes.actionBtn.addEventListener("click", async () => {
      try {
        const result = await postWorkspaceAction(config.primaryActionType);
        const created = result && result.data ? result.data.created_stub : null;
        if (created && created.stub_id) {
          setBanner("hint", "Action recorded. created_stub=" + created.kind + " / " + created.stub_id);
        } else {
          setBanner("hint", "Action recorded successfully.");
        }
        await loadRoute();
      } catch (err) {
        setBanner("error", "Action record failed: " + (err && err.message ? err.message : "unknown_error"));
      }
    });

    loadRoute();
  }

  window.initWorkspaceRoutePage = initWorkspaceRoutePage;
})();
