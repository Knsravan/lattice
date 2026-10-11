// Google Analytics 4 with a small consent prompt.
// Starts with consent "denied" (no cookies, cookieless pings only). If the visitor taps Accept,
// consent becomes "granted" and normal counting runs. The choice is remembered on their device.
// If you change this, update privacy.html to match.
var GA_ID = "G-CER8G1JMFG";
(function () {
  if (!GA_ID) return;
  var KEY = "lattice-consent";
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  if (get() === "granted") gtag("consent", "update", { analytics_storage: "granted" });

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
  document.head.appendChild(s);
  gtag("js", new Date());
  gtag("config", GA_ID);

  if (get()) return;
  function banner() {
    var b = document.createElement("div");
    b.setAttribute("role", "dialog");
    b.setAttribute("aria-label", "Visit counting");
    b.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;width:min(560px,calc(100vw - 24px));" +
      "display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:14px 18px;border-radius:20px;color:#e8ecf1;" +
      "font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:rgba(12,15,24,.78);" +
      "border:1px solid rgba(255,255,255,.22);box-shadow:0 14px 50px rgba(0,0,0,.55);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4)";
    var t = document.createElement("span");
    t.style.cssText = "flex:1 1 240px";
    t.innerHTML = "Count my visit anonymously? It uses a cookie from Google Analytics. <a href='/privacy' style='color:#ffb454'>Details</a>";
    function btn(label, primary, value) {
      var x = document.createElement("button");
      x.type = "button";
      x.textContent = label;
      x.style.cssText = "cursor:pointer;border-radius:999px;padding:8px 16px;font:600 14px system-ui,sans-serif;color:#e8ecf1;border:1px solid rgba(255,255,255,.28);" +
        "background:" + (primary ? "rgba(255,180,84,.28)" : "rgba(255,255,255,.08)");
      x.onclick = function () {
        set(value);
        if (value === "granted") gtag("consent", "update", { analytics_storage: "granted" });
        b.remove();
      };
      return x;
    }
    b.append(t, btn("No thanks", false, "denied"), btn("Accept", true, "granted"));
    document.body.appendChild(b);
  }
  if (document.body) banner(); else document.addEventListener("DOMContentLoaded", banner);
})();
