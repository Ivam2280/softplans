import { MOBILE_QUERY } from "../core/config.js";
import {
  addDays,
  addMonths,
  formatDate,
  getLocalDateString,
  isValidTime,
  isValidDate,
  parseLocalDate,
} from "../core/dates.js";
import { getLanguage, t } from "../i18n/index.js";

const PICKER_LABELS = {
  ru: { tomorrow: "Завтра", nextWeek: "+7 дн.", nextMonth: "+1 мес." },
  uk: { tomorrow: "Завтра", nextWeek: "+7 дн.", nextMonth: "+1 міс." },
  en: { tomorrow: "Tomorrow", nextWeek: "+7d", nextMonth: "+1 mo" },
};

export function createDateTimePicker() {
  const $ = (selector) => document.querySelector(selector);
  const dtPopover = $("#datetime-popover");
  const dtBackdrop = $("#dt-backdrop");
  const dtCard = $("#dt-card");
  const dtDateView = $("#dt-date-view");
  const dtTimeView = $("#dt-time-view");
  const dtDatePresets = $("#dt-date-presets");
  const dtPrevMonth = $("#dt-prev-month");
  const dtNextMonth = $("#dt-next-month");
  const dtMonthTitle = $("#dt-month-title");
  const dtWeekdays = $("#dt-weekdays");
  const dtDaysGrid = $("#dt-days-grid");
  const dtTimeInput = $("#dt-time-input");
  const dtTimePresets = $("#dt-time-presets");
  const dtHoursWheel = $("#dt-hours-wheel");
  const dtMinutesWheel = $("#dt-minutes-wheel");
  const dtClearBtn = $("#dt-clear-btn");
  const dtApplyBtn = $("#dt-apply-btn");
  let activePicker = null;
  let pickerViewYear = new Date().getFullYear();
  let pickerViewMonth = new Date().getMonth();
  let pickerSelectedDate = "";
  let pickerSelectedHour = "09";
  let pickerSelectedMinute = "00";

  function createMinuteButton(val) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dt-wheel-item";
    btn.dataset.value = val;
    btn.textContent = val;
    btn.setAttribute("role", "option");
    btn.tabIndex = -1;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      pickerSelectedMinute = val;
      updateTimeWheelSelection({ scroll: true, updateInput: true });
    });
    return btn;
  }

  function buildTimeWheels() {
    dtHoursWheel.replaceChildren(
      ...Array.from({ length: 24 }, (_, h) => {
        const val = String(h).padStart(2, "0");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dt-wheel-item";
        btn.setAttribute("role", "option");
        btn.tabIndex = -1;
        btn.dataset.value = val;
        btn.textContent = val;
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          pickerSelectedHour = val;
          updateTimeWheelSelection({ scroll: true, updateInput: true });
        });
        return btn;
      }),
    );

    const minuteSteps = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
    dtMinutesWheel.replaceChildren(
      ...minuteSteps.map((val) => {
        return createMinuteButton(val);
      }),
    );

    const timePresets = ["09:00", "12:00", "15:00", "18:00", "20:00"];
    dtTimePresets.replaceChildren(
      ...timePresets.map((preset) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dt-chip";
        btn.dataset.time = preset;
        btn.textContent = preset;
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          const [hh, mm] = preset.split(":");
          pickerSelectedHour = hh;
          pickerSelectedMinute = mm;
          updateTimeWheelSelection({ scroll: true, updateInput: true });
        });
        return btn;
      }),
    );
  }
  buildTimeWheels();

  dtTimeInput.addEventListener("input", () => {
    const digits = dtTimeInput.value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) {
      dtTimeInput.value = `${digits.slice(0, 2)}:${digits.slice(2)}`;
    } else {
      dtTimeInput.value = digits;
    }

    if (digits.length === 4) {
      const hhNum = Math.min(23, Math.max(0, Number(digits.slice(0, 2))));
      const mmNum = Math.min(59, Math.max(0, Number(digits.slice(2, 4))));
      pickerSelectedHour = String(hhNum).padStart(2, "0");
      pickerSelectedMinute = String(mmNum).padStart(2, "0");
      dtTimeInput.value = `${pickerSelectedHour}:${pickerSelectedMinute}`;
      updateTimeWheelSelection({ scroll: true, updateInput: false });
    }
  });

  function normalizeTypedTimeInput() {
    const raw = dtTimeInput.value.trim();
    if (!raw) {
      dtTimeInput.value = `${pickerSelectedHour}:${pickerSelectedMinute}`;
      return;
    }
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      dtTimeInput.value = `${pickerSelectedHour}:${pickerSelectedMinute}`;
      return;
    }
    let hh;
    let mm = 0;
    if (digits.length <= 2) {
      hh = Number(digits);
    } else if (digits.length === 3) {
      hh = Number(digits.slice(0, 1));
      mm = Number(digits.slice(1, 3));
    } else {
      hh = Number(digits.slice(0, 2));
      mm = Number(digits.slice(2, 4));
    }
    hh = Math.min(23, Math.max(0, hh));
    mm = Math.min(59, Math.max(0, mm));
    pickerSelectedHour = String(hh).padStart(2, "0");
    pickerSelectedMinute = String(mm).padStart(2, "0");
    updateTimeWheelSelection({ scroll: true, updateInput: true });
  }

  dtTimeInput.addEventListener("blur", normalizeTypedTimeInput);

  dtPopover.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  dtPopover.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  dtPopover.addEventListener("keydown", (event) => {
    if (!activePicker) return;

    if (event.key === "Tab") {
      const controls = [
        ...dtPopover.querySelectorAll(
          'button:not(:disabled), input:not([type="hidden"]), [tabindex="0"]',
        ),
      ].filter((element) => element.tabIndex >= 0 && element.getClientRects().length);
      const first = controls[0];
      const last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !dtPopover.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dtPopover.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (activePicker.mode === "date") {
      if (!dtDaysGrid.contains(document.activeElement)) return;
      const dayOffsets = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -7,
        ArrowDown: 7,
      };
      if (event.key in dayOffsets) {
        event.preventDefault();
        event.stopPropagation();
        const baseIso = pickerSelectedDate || getLocalDateString();
        let nextIso;
        try {
          nextIso = addDays(baseIso, dayOffsets[event.key]);
        } catch {
          return;
        }
        pickerSelectedDate = nextIso;
        const nextDate = parseLocalDate(nextIso);
        pickerViewYear = nextDate.getFullYear();
        pickerViewMonth = nextDate.getMonth();
        renderCustomCalendar();
        dtDaysGrid.querySelector(`[data-iso="${nextIso}"]`)?.focus();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        applyCustomPickerValue(pickerSelectedDate || getLocalDateString());
      }
    } else if (activePicker.mode === "time") {
      if (document.activeElement === dtTimeInput) {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          normalizeTypedTimeInput();
          applyCustomPickerValue(`${pickerSelectedHour}:${pickerSelectedMinute}`);
        }
        return;
      }

      const inMinutes = dtMinutesWheel.contains(document.activeElement);
      if (!inMinutes && !dtHoursWheel.contains(document.activeElement)) return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        const step = event.key === "ArrowUp" ? -1 : 1;
        if (inMinutes) {
          const options = [...dtMinutesWheel.querySelectorAll(".dt-wheel-item")];
          const curIdx = options.findIndex(
            (option) => option.dataset.value === pickerSelectedMinute,
          );
          pickerSelectedMinute =
            options[(curIdx + step + options.length) % options.length].dataset.value;
          updateTimeWheelSelection({ scroll: true, updateInput: true });
          dtMinutesWheel.querySelector(".dt-wheel-item.is-selected")?.focus();
        } else {
          const nextHour = (Number(pickerSelectedHour) + step + 24) % 24;
          pickerSelectedHour = String(nextHour).padStart(2, "0");
          updateTimeWheelSelection({ scroll: true, updateInput: true });
          dtHoursWheel.querySelector(".dt-wheel-item.is-selected")?.focus();
        }
      } else if (event.key === "ArrowRight" && !inMinutes) {
        event.preventDefault();
        dtMinutesWheel.querySelector(".dt-wheel-item.is-selected")?.focus();
      } else if (event.key === "ArrowLeft" && inMinutes) {
        event.preventDefault();
        dtHoursWheel.querySelector(".dt-wheel-item.is-selected")?.focus();
      } else if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        applyCustomPickerValue(`${pickerSelectedHour}:${pickerSelectedMinute}`);
      }
    }
  });

  dtPopover.addEventListener(
    "wheel",
    (event) => {
      const wheel = event.target.closest(".dt-wheel");
      if (!wheel) {
        event.preventDefault();
        return;
      }
      const atTop = wheel.scrollTop <= 0 && event.deltaY < 0;
      const atBottom =
        wheel.scrollTop + wheel.clientHeight >= wheel.scrollHeight - 1 && event.deltaY > 0;
      if (atTop || atBottom) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  dtPopover.addEventListener(
    "touchmove",
    (event) => {
      if (!event.target.closest(".dt-wheel")) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  function updateTimeWheelSelection({ scroll = false, updateInput = true } = {}) {
    const current = `${pickerSelectedHour}:${pickerSelectedMinute}`;
    if (
      ![...dtMinutesWheel.children].some((option) => option.dataset.value === pickerSelectedMinute)
    ) {
      const option = createMinuteButton(pickerSelectedMinute);
      const next = [...dtMinutesWheel.children].find(
        (child) => Number(child.dataset.value) > Number(pickerSelectedMinute),
      );
      dtMinutesWheel.insertBefore(option, next ?? null);
    }
    if (updateInput && document.activeElement !== dtTimeInput) {
      dtTimeInput.value = current;
    }

    dtHoursWheel.querySelectorAll(".dt-wheel-item").forEach((btn) => {
      const active = btn.dataset.value === pickerSelectedHour;
      btn.classList.toggle("is-selected", active);
      btn.setAttribute("aria-selected", String(active));
      btn.tabIndex = active ? 0 : -1;
      if (active && scroll) {
        btn.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });

    dtMinutesWheel.querySelectorAll(".dt-wheel-item").forEach((btn) => {
      const active = btn.dataset.value === pickerSelectedMinute;
      btn.classList.toggle("is-selected", active);
      btn.setAttribute("aria-selected", String(active));
      btn.tabIndex = active ? 0 : -1;
      if (active && scroll) {
        btn.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });

    dtTimePresets.querySelectorAll(".dt-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.time === current);
    });
  }

  function calendarDate(year, month, day) {
    const date = new Date(0);
    date.setFullYear(year, month, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function renderCustomCalendar() {
    dtPrevMonth.disabled = pickerViewYear === 1 && pickerViewMonth === 0;
    dtNextMonth.disabled = pickerViewYear === 9999 && pickerViewMonth === 11;
    const locale = t("dateLocale");
    const lang = getLanguage();
    const labels = PICKER_LABELS[lang] || PICKER_LABELS.ru;
    const today = getLocalDateString();
    const tomorrow = addDays(today, 1);
    const nextWeek = addDays(today, 7);
    const nextMonth = addMonths(today, 1);

    const presets = [
      { label: t("filterToday"), value: today },
      { label: labels.tomorrow, value: tomorrow },
      { label: labels.nextWeek, value: nextWeek },
      { label: labels.nextMonth, value: nextMonth },
    ];
    dtDatePresets.replaceChildren(
      ...presets.map(({ label, value }) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `dt-chip${pickerSelectedDate === value ? " is-active" : ""}`;
        chip.textContent = label;
        chip.addEventListener("click", (event) => {
          event.stopPropagation();
          pickerSelectedDate = value;
          const parsed = parseLocalDate(value);
          pickerViewYear = parsed.getFullYear();
          pickerViewMonth = parsed.getMonth();
          renderCustomCalendar();
        });
        return chip;
      }),
    );

    const viewDate = calendarDate(pickerViewYear, pickerViewMonth, 1);
    const monthText = formatDate(viewDate, locale, "monthYear");
    dtMonthTitle.textContent = monthText.charAt(0).toLocaleUpperCase(locale) + monthText.slice(1);

    const startMonday = lang !== "en";
    const baseSunday = new Date(2026, 0, 4);
    const weekdayNodes = [];
    for (let i = 0; i < 7; i += 1) {
      const dayOffset = startMonday ? (i + 1) % 7 : i;
      const d = new Date(baseSunday);
      d.setDate(baseSunday.getDate() + dayOffset);
      const span = document.createElement("span");
      span.textContent = formatDate(d, locale, "weekdayShort").slice(0, 2);
      weekdayNodes.push(span);
    }
    dtWeekdays.replaceChildren(...weekdayNodes);

    const firstDayOfMonth = calendarDate(pickerViewYear, pickerViewMonth, 1);
    const rawDay = firstDayOfMonth.getDay();
    const leadingEmpty = startMonday ? (rawDay + 6) % 7 : rawDay;
    const daysInMonth = calendarDate(pickerViewYear, pickerViewMonth + 1, 0).getDate();
    const daysInPrevMonth = calendarDate(pickerViewYear, pickerViewMonth, 0).getDate();

    const cells = [];

    for (let i = leadingEmpty - 1; i >= 0; i -= 1) {
      const dayNum = daysInPrevMonth - i;
      const cellDate = calendarDate(pickerViewYear, pickerViewMonth - 1, dayNum);
      const iso = getLocalDateString(cellDate);
      cells.push(createCalendarDayButton(dayNum, iso, today, true));
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
      const cellDate = calendarDate(pickerViewYear, pickerViewMonth, dayNum);
      const iso = getLocalDateString(cellDate);
      cells.push(createCalendarDayButton(dayNum, iso, today, false));
    }

    const totalCells = Math.ceil(cells.length / 7) * 7;
    const trailingCount = totalCells - cells.length;
    for (let dayNum = 1; dayNum <= trailingCount; dayNum += 1) {
      const cellDate = calendarDate(pickerViewYear, pickerViewMonth + 1, dayNum);
      const iso = getLocalDateString(cellDate);
      cells.push(createCalendarDayButton(dayNum, iso, today, true));
    }

    dtDaysGrid.replaceChildren(...cells);
    const active =
      dtDaysGrid.querySelector(".dt-day.is-selected") ??
      dtDaysGrid.querySelector(".dt-day:not(.is-outside):not(:disabled)");
    if (active) active.tabIndex = 0;
  }

  function createCalendarDayButton(dayNum, iso, today, isOutside) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dt-day";
    btn.dataset.iso = iso;
    if (isOutside) btn.classList.add("is-outside");
    if (iso === today) btn.classList.add("is-today");
    if (iso === pickerSelectedDate) btn.classList.add("is-selected");
    btn.textContent = dayNum;
    btn.tabIndex = -1;
    if (!isValidDate(iso)) {
      btn.disabled = true;
      return btn;
    }
    btn.setAttribute(
      "aria-label",
      formatDate(parseLocalDate(iso), t("dateLocale"), "long") +
        ", " +
        parseLocalDate(iso).getFullYear(),
    );
    btn.setAttribute("aria-pressed", String(iso === pickerSelectedDate));
    if (iso === today) btn.setAttribute("aria-current", "date");
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      pickerSelectedDate = iso;
      const parsed = parseLocalDate(iso);
      pickerViewYear = parsed.getFullYear();
      pickerViewMonth = parsed.getMonth();
      renderCustomCalendar();
      dtDaysGrid.querySelector(`[data-iso="${iso}"]`)?.focus();
    });
    return btn;
  }

  function positionCustomPicker(trigger) {
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;
    const insideDialog = Boolean(trigger.closest("dialog"));

    if (isMobile || insideDialog) {
      dtCard.classList.add("is-centered");
      dtCard.style.removeProperty("left");
      dtCard.style.removeProperty("top");
      return;
    }

    dtCard.classList.remove("is-centered");
    const rect = trigger.getBoundingClientRect();
    const cardRect = dtCard.getBoundingClientRect();
    const margin = 10;

    let left = rect.left;
    if (left + cardRect.width > window.innerWidth - margin) {
      left = window.innerWidth - cardRect.width - margin;
    }
    left = Math.max(margin, left);

    let top = rect.bottom + 8;
    if (top + cardRect.height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - cardRect.height - 8);
    }

    dtCard.style.left = `${Math.round(left)}px`;
    dtCard.style.top = `${Math.round(top)}px`;
  }

  function openCustomPicker({ mode, input, trigger, onUpdate }) {
    if (document.activeElement && document.activeElement.tagName === "INPUT") {
      document.activeElement.blur();
    }

    const hostDialog = trigger.closest("dialog[open]");
    const targetHost = hostDialog || document.body;
    if (dtPopover.parentElement !== targetHost) {
      targetHost.append(dtPopover);
    }

    activePicker = { mode, input, trigger, onUpdate };

    const isDate = mode === "date";
    dtDateView.hidden = !isDate;
    dtTimeView.hidden = isDate;
    dtApplyBtn.hidden = false;

    document.querySelector("#datetime-title").textContent = t(
      isDate ? "datePickerTitle" : "timePickerTitle",
    );
    if (isDate) {
      pickerSelectedDate = isValidDate(input.value) ? input.value : getLocalDateString();
      const baseDate = parseLocalDate(pickerSelectedDate);
      pickerViewYear = baseDate.getFullYear();
      pickerViewMonth = baseDate.getMonth();
      renderCustomCalendar();
    } else {
      const initialTime = isValidTime(input.value) ? input.value : "09:00";
      const [hh, mm] = initialTime.split(":");
      pickerSelectedHour = hh || "09";
      pickerSelectedMinute = mm || "00";
      updateTimeWheelSelection({ scroll: false, updateInput: true });
    }

    dtPopover.hidden = false;
    positionCustomPicker(trigger);
    dtPopover.classList.add("is-open");
    if (isDate) {
      dtDaysGrid.querySelector(".dt-day.is-selected")?.focus();
    } else {
      updateTimeWheelSelection({ scroll: true, updateInput: true });
      dtHoursWheel.querySelector(".dt-wheel-item.is-selected")?.focus({ preventScroll: true });
    }
  }

  function closeCustomPicker({ restoreFocus = true } = {}) {
    if (!activePicker) return;
    const { trigger } = activePicker;
    activePicker = null;
    dtPopover.classList.remove("is-open");
    dtPopover.hidden = true;
    if (dtPopover.parentElement !== document.body) {
      document.body.append(dtPopover);
    }
    if (restoreFocus && trigger?.isConnected && trigger.getClientRects().length) {
      trigger.focus({ preventScroll: true });
    }
  }

  function applyCustomPickerValue(value) {
    if (!activePicker) return;
    const { input, onUpdate } = activePicker;
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    onUpdate?.();
    closeCustomPicker();
  }

  dtPrevMonth.addEventListener("click", (event) => {
    event.stopPropagation();
    pickerViewMonth -= 1;
    if (pickerViewMonth < 0) {
      pickerViewMonth = 11;
      pickerViewYear -= 1;
    }
    renderCustomCalendar();
  });

  dtNextMonth.addEventListener("click", (event) => {
    event.stopPropagation();
    pickerViewMonth += 1;
    if (pickerViewMonth > 11) {
      pickerViewMonth = 0;
      pickerViewYear += 1;
    }
    renderCustomCalendar();
  });

  dtClearBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    applyCustomPickerValue("");
  });

  dtApplyBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!activePicker) return;
    if (activePicker.mode === "time") {
      normalizeTypedTimeInput();
      applyCustomPickerValue(`${pickerSelectedHour}:${pickerSelectedMinute}`);
    } else {
      applyCustomPickerValue(pickerSelectedDate || getLocalDateString());
    }
  });

  dtBackdrop.addEventListener("click", (event) => {
    event.stopPropagation();
    closeCustomPicker();
  });

  return {
    open: openCustomPicker,
    close: closeCustomPicker,
    isOpen: () => Boolean(activePicker),
    reposition: () => {
      if (activePicker) positionCustomPicker(activePicker.trigger);
    },
  };
}
