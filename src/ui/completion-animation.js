import { MOBILE_QUERY } from "../core/config.js";

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createCompletionAnimation({ planningList, onCommit }) {
  const GENIE_SLICES = 18;
  const GENIE_FLIGHT_MS = 620;
  const GENIE_STAGGER_MS = 160;

  const GENIE_MOBILE_COLUMNS = 28;
  const GENIE_MOBILE_FLIGHT_MS = 640;
  const GENIE_MOBILE_STAGGER_MS = 300;

  const GENIE_HOLD_MS = 0;
  const GENIE_COMMIT_MS = 290;
  const GENIE_ARRIVE_MS = 560;
  const genieBusy = new Set();

  function getGenieTarget() {
    if (document.documentElement.classList.contains("is-keyboard-open")) return null;
    const button = planningList.querySelector('[data-filter="completed"]');
    if (!button) return null;
    const anchor = button.querySelector(".nav-icon") || button;
    const rect = anchor.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
    return { x, y, button };
  }

  function pulseGenieTarget(button) {
    if (!button) return;
    button.classList.remove("is-genie-receiving");
    void button.offsetWidth;
    button.classList.add("is-genie-receiving");
    window.setTimeout(() => button.classList.remove("is-genie-receiving"), 700);
  }

  function playGenieFlight(item, rect, target) {
    const byColumns = window.matchMedia(MOBILE_QUERY).matches;
    const count = byColumns ? GENIE_MOBILE_COLUMNS : GENIE_SLICES;
    const flightMs = byColumns ? GENIE_MOBILE_FLIGHT_MS : GENIE_FLIGHT_MS;
    const staggerMs = byColumns ? GENIE_MOBILE_STAGGER_MS : GENIE_STAGGER_MS;

    const layer = document.createElement("div");
    layer.className = "genie-layer";
    layer.setAttribute("aria-hidden", "true");

    const base = item.cloneNode(true);
    base.classList.add("is-completed", "genie-clone");
    base.classList.remove("is-genie-leaving");
    base.removeAttribute("data-task-id");
    base.style.width = `${rect.width}px`;
    base.style.height = `${rect.height}px`;
    base.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    base.querySelectorAll("button, input").forEach((el) => {
      el.tabIndex = -1;
    });
    const baseCheck = base.querySelector(".task-check");
    if (baseCheck) {
      baseCheck.checked = true;
      baseCheck.setAttribute("checked", "");
    }

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const targetIsBelow = target.y > centerY;
    const sliceSize = (byColumns ? rect.width : rect.height) / count;

    const maxColumnDistance = byColumns
      ? Math.max(
          1,
          Math.abs(target.x - (rect.left + sliceSize / 2)),
          Math.abs(target.x - (rect.left + rect.width - sliceSize / 2)),
        )
      : 1;

    const animations = [];

    for (let i = 0; i < count; i += 1) {
      const slice = document.createElement("div");
      slice.className = "genie-slice";
      slice.style.left = `${rect.left}px`;
      slice.style.top = `${rect.top}px`;
      slice.style.width = `${rect.width}px`;
      slice.style.height = `${rect.height}px`;

      let dx;
      let dy;
      let order;
      let mid;

      if (byColumns) {
        const clipLeft = i === 0 ? 0 : i * sliceSize - 0.75;
        const clipRight =
          i === count - 1 ? 0 : Math.max(0, rect.width - (i + 1) * sliceSize - 0.75);
        slice.style.clipPath = `inset(0 ${clipRight}px 0 ${clipLeft}px)`;

        const localCenterX = (i + 0.5) * sliceSize;
        slice.style.transformOrigin = `${localCenterX}px 50%`;

        dx = target.x - (rect.left + localCenterX);
        dy = target.y - centerY;
        order = Math.min(1, Math.abs(dx) / maxColumnDistance);
        mid = null;
      } else {
        const clipTop = i === 0 ? 0 : i * sliceSize - 0.75;
        const clipBottom =
          i === count - 1 ? 0 : Math.max(0, rect.height - (i + 1) * sliceSize - 0.75);
        slice.style.clipPath = `inset(${clipTop}px 0 ${clipBottom}px 0)`;

        const localCenterY = (i + 0.5) * sliceSize;
        slice.style.transformOrigin = `50% ${localCenterY}px`;

        dx = target.x - centerX;
        dy = target.y - (rect.top + localCenterY);
        order = (targetIsBelow ? count - 1 - i : i) / (count - 1);
        mid = `translate3d(${dx * 0.14}px, ${dy * 0.2}px, 0) scale(0.7, 0.8)`;
      }

      slice.append(i === 0 ? base : base.cloneNode(true));
      layer.append(slice);

      const delay = GENIE_HOLD_MS + order * staggerMs;
      const timing = { duration: flightMs, delay, fill: "both", easing: "linear" };

      const finalTransform = `translate3d(${dx}px, ${dy}px, 0) scale(0.04, 0.04)`;
      const frames = mid
        ? [
            {
              offset: 0,
              transform: "translate3d(0, 0, 0) scale(1, 1)",
              easing: "cubic-bezier(0.3, 0, 0.3, 1)",
            },
            {
              offset: 0.38,
              transform: mid,
              easing: "cubic-bezier(0.55, 0, 0.85, 0.4)",
            },
            { offset: 1, transform: finalTransform },
          ]
        : [
            {
              offset: 0,
              transform: "translate3d(0, 0, 0) scale(1, 1)",
              easing: "cubic-bezier(0.4, 0, 0.75, 0.6)",
            },
            { offset: 1, transform: finalTransform },
          ];

      animations.push(
        slice.animate(frames, timing),
        slice.animate([{ opacity: 1 }, { opacity: 1, offset: 0.86 }, { opacity: 0 }], timing),
      );
    }

    const glow = document.createElement("div");
    glow.className = "genie-glow";
    glow.style.left = `${target.x}px`;
    glow.style.top = `${target.y}px`;
    layer.append(glow);
    animations.push(
      glow.animate(
        [
          { opacity: 0, transform: "translate(-50%, -50%) scale(0.3)" },
          { opacity: 0.8, transform: "translate(-50%, -50%) scale(1)", offset: 0.55 },
          { opacity: 0, transform: "translate(-50%, -50%) scale(1.5)" },
        ],
        { duration: 700, delay: 90, fill: "both", easing: "ease-out" },
      ),
    );

    document.body.append(layer);

    const cleanup = () => layer.remove();
    Promise.allSettled(animations.map((animation) => animation.finished)).then(cleanup);
    window.setTimeout(cleanup, GENIE_HOLD_MS + staggerMs + flightMs + 600);
  }

  function completeTaskWithGenie(taskId, item) {
    if (genieBusy.has(taskId)) return;

    const commit = (withFlip) => {
      genieBusy.delete(taskId);
      onCommit(taskId, withFlip);
    };

    const target = getGenieTarget();
    const canAnimate =
      Boolean(target) &&
      Boolean(item) &&
      item.isConnected &&
      typeof item.animate === "function" &&
      !prefersReducedMotion();
    const rect = canAnimate ? item.getBoundingClientRect() : null;

    if (
      !canAnimate ||
      rect.width < 1 ||
      rect.height < 1 ||
      rect.bottom < 0 ||
      rect.top > window.innerHeight
    ) {
      commit(false);
      return;
    }

    genieBusy.add(taskId);
    playGenieFlight(item, rect, target);
    item.classList.add("is-genie-leaving");

    window.setTimeout(() => commit(true), GENIE_COMMIT_MS);
    window.setTimeout(() => pulseGenieTarget(target.button), GENIE_ARRIVE_MS);
  }
  return { complete: completeTaskWithGenie, isBusy: () => genieBusy.size > 0 };
}
