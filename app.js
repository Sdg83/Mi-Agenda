// ===== CONSTANTS =====
const DAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const TYPE_ICONS = { task:'✅', trabajo:'🔧', cumple:'🎂', evento:'🎉' };
const TYPE_LABELS = { task:'Tarea', trabajo:'Trabajo programado', cumple:'Cumpleaños', evento:'Evento' };
const ALARM_LABELS = { none:'Sin alarma', '5':'5 min antes', '15':'15 min antes', '30':'30 min antes', '60':'1 h antes', '1440':'1 día antes' };
const STORAGE_KEY = 'mi_agenda_events';
const SETTINGS_KEY = 'mi_agenda_settings';

// ===== STATE =====
let events = [];
let settings = { push: false, vibDefault: true, defaultSound: 'chime' };
let selectedType = 'task';
let fieldStates = { repeat: false, vib: true };
let activeFilter = 'all';
let calDate = new Date();
let calSelectedDate = null;
let alarmTimers = {};
let snoozeTimer = null;
let activeAlarmEvent = null;
let audioCtx = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
loadData();
setHeaderDate();
renderDashboard();
renderCalendar();
renderAlarms();
updateSettingsUI();
scheduleAlarms();
registerServiceWorker();
setInterval(checkAlarms, 30000);
});

// ===== STORAGE =====
function loadData() {
try {
const raw = localStorage.getItem(STORAGE_KEY);
events = raw ? JSON.parse(raw) : getSampleEvents();
const sraw = localStorage.getItem(SETTINGS_KEY);
if (sraw) settings = { ...settings, ...JSON.parse(sraw) };
} catch(e) {
events = getSampleEvents();
}
}

function saveData() {
localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function saveSettings() {
localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getSampleEvents() {
const today = todayStr();
const tomorrow = dayStr(new Date(Date.now() + 86400000));
return [
{ id: uid(), type: 'task', name: 'Revisar backup servidor Martínez', date: today, time: '10:00', alarm: '15', sound: 'chime', repeat: false, vib: true, done: false, note: '' },
{ id: uid(), type: 'trabajo', name: 'Visita mantenimiento - Local Tigre', date: today, time: '14:30', alarm: '30', sound: 'bell', repeat: false, vib: true, done: false, note: 'Llevar herramientas y SSD de repuesto' },
{ id: uid(), type: 'cumple', name: 'Cumpleaños de Laura', date: today, time: '09:00', alarm: '1440', sound: 'chime', repeat: true, vib: false, done: false, note: '' },
{ id: uid(), type: 'task', name: 'Actualizar antivirus clientes zona norte', date: today, time: '16:00', alarm: '15', sound: 'pulse', repeat: false, vib: true, done: false, note: '' },
{ id: uid(), type: 'evento', name: 'Reunión con socio minería BTC', date: tomorrow, time: '11:00', alarm: '60', sound: 'alert', repeat: false, vib: true, done: false, note: 'Ver hashrate y ganancias del mes' },
{ id: uid(), type: 'trabajo', name: 'Instalación cámaras - Depósito Luján', date: tomorrow, time: '09:30', alarm: '30', sound: 'bell', repeat: false, vib: true, done: false, note: '' },
{ id: uid(), type: 'task', name: 'Comprar SSD 1TB para cliente', date: tomorrow, time: '15:00', alarm: 'none', sound: 'chime', repeat: false, vib: false, done: false, note: '' },
];
}

// ===== HELPERS =====
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayStr() { return dayStr(new Date()); }
function dayStr(d) { return d.toISOString().split('T')[0]; }
function tomorrowStr() { return dayStr(new Date(Date.now() + 86400000)); }

function formatDateLabel(d) {
if (d === todayStr()) return 'Hoy';
if (d === tomorrowStr()) return 'Mañana';
const dt = new Date(d + 'T12:00:00');
return DAYS[dt.getDay()].slice(0,3) + ', ' + dt.getDate() + ' de ' + MONTHS[dt.getMonth()];
}

// ===== HEADER =====
function setHeaderDate() {
const now = new Date();
document.getElementById('headerDate').textContent =
DAYS[now.getDay()] + ', ' + now.getDate() + ' de ' + MONTHS[now.getMonth()];
}

// ===== TABS =====
function switchTab(name) {
document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
document.getElementById('tab-' + name).classList.add('active');
document.querySelector([data-tab="${name}"]).classList.add('active');
if (name === 'calendario') renderCalendar();
if (name === 'alarmas') renderAlarms();
if (name === 'ajustes') updateSettingsTotal();
}

// ===== DASHBOARD =====
function renderDashboard() {
const today = todayStr();
const todayEvents = events.filter(e => e.date === today && !e.done);
['task','trabajo','cumple','evento'].forEach(t => {
const el = document.getElementById('count' + t.charAt(0).toUpperCase() + t.slice(1));
if (el) el.textContent = todayEvents.filter(e => e.type === t).length;
});
renderEventsList();
}

function filterByType(type) {
activeFilter = type;
document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
document.querySelector([data-filter="${type}"])?.classList.add('active');
renderEventsList();
}

function applyFilter(filter, el) {
activeFilter = filter;
document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
el.classList.add('active');
renderEventsList();
}

function renderEventsList() {
let filtered = activeFilter === 'all' ? [...events] : events.filter(e => e.type === activeFilter);
filtered.sort((a, b) => {
const dc = a.date.localeCompare(b.date);
return dc !== 0 ? dc : a.time.localeCompare(b.time);
});

const grouped = {};
filtered.forEach(e => {
if (!grouped[e.date]) grouped[e.date] = [];
grouped[e.date].push(e);
});

const list = document.getElementById('eventsList');
const empty = document.getElementById('emptyState');

if (filtered.length === 0) {
list.innerHTML = '';
empty.style.display = 'block';
return;
}
empty.style.display = 'none';

let html = '';
Object.keys(grouped).sort().forEach(date => {
html += <div class="date-divider">${formatDateLabel(date)}</div>;
grouped[date].forEach(e => {
html += renderEventCard(e);
});
});
list.innerHTML = html;
}

function renderEventCard(e) {
const badges = [];
if (e.alarm !== 'none') badges.push(<span class="badge badge-alarm">🔔 ${ALARM_LABELS[e.alarm]}</span>);
if (e.repeat) badges.push(<span class="badge badge-repeat">↻ Anual</span>);
if (e.note) badges.push(<span class="badge badge-note">📝</span>);

return `



${TYPE_ICONS[e.type]}


${e.name}


${TYPE_LABELS[e.type]}
${badges.length ? '·' + badges.join('') : ''}



${e.time || ''}

`; }
function toggleDone(id) {
const e = events.find(x => x.id === id);
if (e) {
e.done = !e.done;
saveData();
renderDashboard();
}
}

// ===== CALENDAR =====
function renderCalendar() {
const year = calDate.getFullYear();
const month = calDate.getMonth();
document.getElementById('calMonthYear').textContent = MONTHS[month].charAt(0).toUpperCase() + MONTHS[month].slice(1) + ' ' + year;

const firstDay = new Date(year, month, 1).getDay();
const daysInMonth = new Date(year, month + 1, 0).getDate();
const daysInPrev = new Date(year, month, 0).getDate();
const today = todayStr();

let html = '';
// Prev month days
for (let i = firstDay - 1; i >= 0; i--) {
const d = daysInPrev - i;
const dateStr = dayStr(new Date(year, month - 1, d));
const hasEv = events.some(e => e.date === dateStr);
html += <div class="cal-day other-month${hasEv?' has-events':''}" onclick="selectCalDay('${dateStr}')">${d}</div>;
}
// Current month
for (let d = 1; d <= daysInMonth; d++) {
const dateStr = dayStr(new Date(year, month, d));
const isToday = dateStr === today;
const isSelected = dateStr === calSelectedDate;
const hasEv = events.some(e => e.date === dateStr && !e.done);
const cls = ['cal-day', isToday?'today':'', isSelected&&!isToday?'selected':'', hasEv?'has-events':''].filter(Boolean).join(' ');
html += <div class="${cls}" onclick="selectCalDay('${dateStr}')">${d}${hasEv?'<div class="cal-dot"></div>':''}</div>;
}
// Next month
const total = firstDay + daysInMonth;
const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
for (let d = 1; d <= remaining; d++) {
const dateStr = dayStr(new Date(year, month + 1, d));
const hasEv = events.some(e => e.date === dateStr);
html += <div class="cal-day other-month${hasEv?' has-events':''}" onclick="selectCalDay('${dateStr}')">${d}</div>;
}

document.getElementById('calGrid').innerHTML = html;
if (calSelectedDate) renderCalDayEvents(calSelectedDate);
}

function selectCalDay(dateStr) {
calSelectedDate = dateStr;
renderCalendar();
renderCalDayEvents(dateStr);
}

function renderCalDayEvents(dateStr) {
const dayEvs = events.filter(e => e.date === dateStr);
const container = document.getElementById('calDayEvents');
if (dayEvs.length === 0) {
container.innerHTML = <div class="cal-day-title">${formatDateLabel(dateStr)}</div><div class="empty-state" style="padding:30px 0"><div class="empty-text">Sin eventos este día</div></div>;
return;
}
let html = <div class="cal-day-title">${formatDateLabel(dateStr)}</div>;
dayEvs.forEach(e => { html += renderEventCard(e); });
container.innerHTML = html;
}

function prevMonth() {
calDate.setMonth(calDate.getMonth() - 1);
renderCalendar();
}
function nextMonth() {
calDate.setMonth(calDate.getMonth() + 1);
renderCalendar();
}

// ===== ALARMS TAB =====
function renderAlarms() {
const withAlarms = events.filter(e => e.alarm !== 'none' && !e.done)
.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

const container = document.getElementById('alarmasList');
const empty = document.getElementById('emptyAlarmas');

if (withAlarms.length === 0) {
container.innerHTML = '';
empty.style.display = 'block';
return;
}
empty.style.display = 'none';

container.innerHTML = withAlarms.map(e => <div class="alarm-item"> <div class="alarm-item-icon">${TYPE_ICONS[e.type]}</div> <div class="alarm-item-info"> <div class="alarm-item-name">${e.name}</div> <div class="alarm-item-when">${formatDateLabel(e.date)} · ${e.time} · ${ALARM_LABELS[e.alarm]} · 🔊 ${e.sound}${e.vib?' · 📳':''}</div> </div> <div class="alarm-toggle"> <div class="toggle${!e.alarmOff?' on':''}" onclick="toggleAlarmOff('${e.id}', this)"></div> </div> </div>).join('');
}

function toggleAlarmOff(id, el) {
const e = events.find(x => x.id === id);
if (e) {
e.alarmOff = !e.alarmOff;
el.classList.toggle('on');
saveData();
scheduleAlarms();
}
}

// ===== ALARM SCHEDULING =====
function scheduleAlarms() {
Object.values(alarmTimers).forEach(clearTimeout);
alarmTimers = {};
const now = Date.now();
events.filter(e => e.alarm !== 'none' && !e.done && !e.alarmOff).forEach(e => {
const eventTime = new Date(e.date + 'T' + (e.time || '00:00') + ':00').getTime();
const alarmTime = eventTime - (parseInt(e.alarm) * 60000);
const delay = alarmTime - now;
if (delay > 0 && delay < 86400000) {
alarmTimers[e.id] = setTimeout(() => fireAlarm(e), delay);
}
});
}

function checkAlarms() {
scheduleAlarms();
}

function fireAlarm(ev) {
activeAlarmEvent = ev;
document.getElementById('toastIcon').textContent = TYPE_ICONS[ev.type];
document.getElementById('toastName').textContent = ev.name;
document.getElementById('toastTime').textContent = formatDateLabel(ev.date) + ' · ' + ev.time;
document.getElementById('alarmToast').classList.add('show');
playAlarmSound(ev.sound);
if (ev.vib && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
sendPushNotification(ev);
}

function dismissAlarm() {
document.getElementById('alarmToast').classList.remove('show');
clearTimeout(snoozeTimer);
activeAlarmEvent = null;
}

function snoozeAlarm() {
document.getElementById('alarmToast').classList.remove('show');
clearTimeout(snoozeTimer);
const ev = activeAlarmEvent;
if (ev) {
snoozeTimer = setTimeout(() => fireAlarm(ev), 10 * 60 * 1000);
}
}

// ===== PUSH NOTIFICATIONS =====
async function registerServiceWorker() {
if ('serviceWorker' in navigator) {
try {
await navigator.serviceWorker.register('sw.js');
} catch(e) {}
}
}

async function requestPushPermission() {
if (!('Notification' in window)) return false;
if (Notification.permission === 'granted') return true;
const result = await Notification.requestPermission();
return result === 'granted';
}

async function sendPushNotification(ev) {
if (!('Notification' in window) || Notification.permission !== 'granted') return;
if ('serviceWorker' in navigator) {
const reg = await navigator.serviceWorker.ready;
reg.showNotification('⏰ ' + ev.name, {
body: TYPE_LABELS[ev.type] + ' · ' + formatDateLabel(ev.date) + ' · ' + ev.time,
icon: 'icons/icon-192.png',
badge: 'icons/icon-192.png',
vibrate: ev.vib ? [200, 100, 200] : [],
tag: ev.id,
actions: [
{ action: 'snooze', title: 'Snooze 10 min' },
{ action: 'dismiss', title: 'Descartar' }
]
});
} else {
new Notification('⏰ ' + ev.name, {
body: TYPE_LABELS[ev.type] + ' · ' + ev.time,
icon: 'icons/icon-192.png'
});
}
}

// ===== AUDIO =====
function getAudioCtx() {
if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
return audioCtx;
}

function playAlarmSound(type) {
try {
const ctx = getAudioCtx();
if (ctx.state === 'suspended') ctx.resume();
if (type === 'chime') {
[523, 659, 784, 1047].forEach((f, i) => {
const o = ctx.createOscillator(); const g = ctx.createGain();
o.connect(g); g.connect(ctx.destination);
o.frequency.value = f; o.type = 'sine';
const t = ctx.currentTime + i * 0.16;
g.gain.setValueAtTime(0, t);
g.gain.linearRampToValueAtTime(0.18, t + 0.03);
g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
o.start(t); o.stop(t + 0.7);
});
} else if (type === 'bell') {
[1047, 1319, 1568].forEach((f, i) => {
const o = ctx.createOscillator(); const g = ctx.createGain();
o.connect(g); g.connect(ctx.destination);
o.frequency.value = f; o.type = 'sine';
const t = ctx.currentTime + i * 0.08;
g.gain.setValueAtTime(0.2, t);
g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
o.start(t); o.stop(t + 1.4);
});
} else if (type === 'pulse') {
[0, 0.28, 0.56, 0.84].forEach(d => {
const o = ctx.createOscillator(); const g = ctx.createGain();
o.connect(g); g.connect(ctx.destination);
o.frequency.value = 880; o.type = 'square';
const t = ctx.currentTime + d;
g.gain.setValueAtTime(0, t);
g.gain.linearRampToValueAtTime(0.12, t + 0.01);
g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
o.start(t); o.stop(t + 0.24);
});
} else if (type === 'alert') {
[440, 554, 440, 554, 440].forEach((f, i) => {
const o = ctx.createOscillator(); const g = ctx.createGain();
o.connect(g); g.connect(ctx.destination);
o.frequency.value = f; o.type = 'sawtooth';
const t = ctx.currentTime + i * 0.15;
g.gain.setValueAtTime(0.1, t);
g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
o.start(t); o.stop(t + 0.13);
});
}
} catch(e) {}
}

// ===== MODAL =====
function openModal() {
const now = new Date();
const h = now.getHours().toString().padStart(2,'0');
const m = now.getMinutes().toString().padStart(2,'0');
document.getElementById('inputName').value = '';
document.getElementById('inputDate').value = todayStr();
document.getElementById('inputTime').value = h + ':' + m;
document.getElementById('inputAlarm').value = '15';
document.getElementById('inputSound').value = settings.defaultSound;
document.getElementById('inputNote').value = '';
fieldStates = { repeat: false, vib: settings.vibDefault };
document.getElementById('toggleRepeat').classList.toggle('on', false);
document.getElementById('toggleVib').classList.toggle('on', settings.vibDefault);
document.getElementById('repeatRow').style.display = 'none';

// Reset type
document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
document.querySelector('[data-type="task"]').classList.add('selected');
selectedType = 'task';

document.getElementById('modalBackdrop').classList.add('open');
setTimeout(() => document.getElementById('inputName').focus(), 320);
}

function closeModal() {
document.getElementById('modalBackdrop').classList.remove('open');
}

function closeModalBg(e) {
if (e.target === document.getElementById('modalBackdrop')) closeModal();
}

function selectType(type, el) {
selectedType = type;
document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
el.classList.add('selected');
const isRepeat = type === 'cumple';
document.getElementById('repeatRow').style.display = isRepeat ? 'flex' : 'none';
if (isRepeat) {
fieldStates.repeat = true;
document.getElementById('toggleRepeat').classList.add('on');
}
}

function toggleField(field, el) {
fieldStates[field] = !fieldStates[field];
el.classList.toggle('on');
}

function saveEvent() {
const name = document.getElementById('inputName').value.trim();
if (!name) {
document.getElementById('inputName').style.borderColor = 'var(--coral)';
document.getElementById('inputName').focus();
setTimeout(() => document.getElementById('inputName').style.borderColor = '', 2000);
return;
}

const ev = {
id: uid(),
type: selectedType,
name,
date: document.getElementById('inputDate').value || todayStr(),
time: document.getElementById('inputTime').value || '00:00',
alarm: document.getElementById('inputAlarm').value,
sound: document.getElementById('inputSound').value,
repeat: fieldStates.repeat,
vib: fieldStates.vib,
note: document.getElementById('inputNote').value.trim(),
done: false,
alarmOff: false,
};

events.push(ev);
saveData();
closeModal();
renderDashboard();
renderAlarms();
scheduleAlarms();
playAlarmSound('chime');
}

// ===== SETTINGS =====
function toggleSetting(key, el) {
settings[key] = !settings[key];
el.classList.toggle('on');
saveSettings();
if (key === 'push' && settings[key]) {
requestPushPermission().then(granted => {
if (!granted) {
settings.push = false;
el.classList.remove('on');
saveSettings();
}
});
}
}

function saveSetting(key, val) {
settings[key] = val;
saveSettings();
}

function updateSettingsUI() {
document.getElementById('togglePush').classList.toggle('on', settings.push);
document.getElementById('toggleVibDefault').classList.toggle('on', settings.vibDefault);
document.getElementById('defaultSound').value = settings.defaultSound;
}

function updateSettingsTotal() {
document.getElementById('totalEvents').textContent = events.length;
}

function clearDone() {
if (!confirm('¿Eliminar todos los eventos completados?')) return;
events = events.filter(e => !e.done);
saveData();
renderDashboard();
renderAlarms();
}

function exportData() {
const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'mi-agenda-' + todayStr() + '.json';
a.click();
URL.revokeObjectURL(url);
}

// ===== KEYBOARD =====
document.addEventListener('keydown', e => {
if (e.key === 'Escape') closeModal();
if ((e.key === 'Enter') && document.getElementById('modalBackdrop').classList.contains('open')) {
if (document.activeElement !== document.getElementById('inputNote')) saveEvent();
}
});
