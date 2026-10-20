// Небольшой календарь без библиотек. Выбор хранится в черновике до кнопки «Выбрать».
const pickerDialog = document.querySelector("#date-dialog");
const pickerForm = document.querySelector("#date-picker-form");
const pickerTrigger = document.querySelector("#deadline");
const pickerValue = document.querySelector("#deadline-value");
const pickerLabel = document.querySelector("#deadline-label");
const pickerDays = document.querySelector("#calendar-days");
const pickerHours = document.querySelector("#picker-hours");
const pickerMinutes = document.querySelector("#picker-minutes");
let selectedDay = "";
let visibleMonth = new Date();
let pickerClosing = false;
// Один календарь используется и в добавлении, и в окне редактирования.
let pickerTargetValue = pickerValue;
let pickerTargetLabel = pickerLabel;
let pickerTargetTrigger = pickerTrigger;

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function openDeadlinePicker(valueInput = pickerValue, label = pickerLabel, trigger = pickerTrigger) {
  pickerTargetValue = valueInput;
  pickerTargetLabel = label;
  pickerTargetTrigger = trigger;
  const initial = valueInput.value ? new Date(valueInput.value) : new Date(Date.now() + 3600000);
  selectedDay = localDateString(initial);
  visibleMonth = new Date(initial.getFullYear(), initial.getMonth(), 1);
  pickerHours.value = String(initial.getHours()).padStart(2, "0");
  pickerMinutes.value = String(initial.getMinutes()).padStart(2, "0");
  renderCalendar();
  pickerDialog.classList.remove("closing");
  pickerDialog.showModal();
  pickerDays.querySelector('[aria-pressed="true"]').focus();
}

function closeDeadlinePicker() {
  if (pickerClosing) return;
  pickerClosing = true;
  pickerDialog.classList.add("closing");
  // Небольшая задержка даёт проиграться CSS-анимации закрытия.
  setTimeout(() => {
    pickerDialog.close();
    pickerDialog.classList.remove("closing");
    pickerClosing = false;
    pickerTargetTrigger.focus();
  }, 160);
}

function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  document.querySelector("#calendar-month").textContent = visibleMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  document.querySelector("#previous-month").disabled = year === 2000 && month === 0;
  document.querySelector("#next-month").disabled = year === 2100 && month === 11;
  pickerDays.replaceChildren();

  // В Date воскресенье — 0. В календаре первым показываем понедельник.
  const emptyCells = (new Date(year, month, 1).getDay() + 6) % 7;
  for (let index = 0; index < emptyCells; index++) pickerDays.append(document.createElement("span"));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const value = localDateString(date);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = day;
    button.setAttribute("aria-label", date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }));
    button.setAttribute("aria-pressed", String(value === selectedDay));
    if (value === localDateString(new Date())) button.setAttribute("aria-current", "date");
    button.addEventListener("click", () => {
      selectedDay = value;
      renderCalendar();
      pickerDays.querySelector('[aria-pressed="true"]').focus();
    });
    pickerDays.append(button);
  }
}

function setDeadlinePicker(value, valueInput = pickerValue, label = pickerLabel) {
  valueInput.value = value;
  label.textContent = value ? formatDate(value) : "";
}

function resetDeadlinePicker() {
  setDeadlinePicker("");
}

pickerTrigger.addEventListener("click", () => openDeadlinePicker());
document.querySelector("#close-date-picker").addEventListener("click", closeDeadlinePicker);
pickerDialog.addEventListener("cancel", event => {
  event.preventDefault();
  closeDeadlinePicker();
});
pickerDialog.addEventListener("click", event => {
  if (event.target !== pickerDialog) return;
  const box = pickerDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDeadlinePicker();
});
for (const [id, offset] of [["#previous-month", -1], ["#next-month", 1]]) {
  document.querySelector(id).addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    renderCalendar();
  });
}
document.querySelector("#picker-today").addEventListener("click", () => {
  const today = new Date();
  selectedDay = localDateString(today);
  visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  renderCalendar();
});
pickerForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!pickerForm.reportValidity()) return;
  const hours = pickerHours.value.padStart(2, "0");
  const minutes = pickerMinutes.value.padStart(2, "0");
  const value = `${selectedDay}T${hours}:${minutes}`;
  // Общая проверка даты находится в app.js.
  if (!isValidDeadline(value)) return;
  setDeadlinePicker(value, pickerTargetValue, pickerTargetLabel);
  closeDeadlinePicker();
});
