self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  const title = d.title || "易問・每日一卦";
  const body = d.body || "今日一卦已備好，點開看看。";
  const url = d.url || "https://yiwen.taicalc.com/";
  e.waitUntil(self.registration.showNotification(title, { body, data: { url }, tag: "yiwen-daily" }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "https://yiwen.taicalc.com/";
  e.waitUntil(clients.openWindow(url));
});
