// Google Analytics 4. Off until a Measurement ID is set below (looks like "G-XXXXXXXXXX").
// Consent Mode starts at "denied": Google stores no cookies and only receives cookieless pings.
// If you change this, update privacy.html to match.
var GA_ID = "G-CER8G1JMFG";
if (GA_ID) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
  document.head.appendChild(s);
  gtag("js", new Date());
  gtag("config", GA_ID);
}
