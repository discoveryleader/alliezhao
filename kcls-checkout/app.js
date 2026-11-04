/* KCLS Self-Checkout prototype
   Flow: Sign in → Check out items → Receipt → back to Sign in
   Side paths: Get a library card, High Contrast toggle, Cancel.
   Demo credentials: card 0052908415 · PIN 0926 */
(() => {
  const DEMO = { card: "0052908415", pin: "0926" };
  const stage = document.getElementById("stage");
  const $ = (id) => document.getElementById(id);

  /* ---------- Scale the 1920×1080 kiosk to fit the window ---------- */
  const fit = () => {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.setProperty("--scale", s);
  };
  addEventListener("resize", fit);
  fit();

  /* ---------- Library-card barcode (bar x/width pairs from the design) ---------- */
  const BARS = [
    [6, 5.7], [17.4, 3.8], [28.8, 9.5], [42.1, 3.8], [51.6, 5.7], [66.8, 11.4], [82, 3.8], [93.4, 7.6],
    [104.8, 5.7], [116.2, 3.8], [129.5, 9.5], [142.8, 5.7], [156.1, 3.8], [165.6, 11.4], [180.8, 7.6],
    [197.9, 3.8], [207.4, 5.7], [216.9, 9.5], [234, 3.8], [241.6, 7.6], [258.7, 5.7], [270.1, 11.4],
    [285.3, 3.8], [296.7, 5.7], [308.1, 9.5], [321.4, 3.8], [334.7, 7.6], [348, 3.8], [359.4, 5.7],
    [368.9, 11.4], [386, 3.8], [399.3, 9.5], [412.6, 5.7], [425.9, 3.8], [435.4, 7.6], [446.8, 5.7],
    [462, 9.5], [475.3, 3.8], [486.7, 11.4],
  ];
  const barcode = $("barcode");
  BARS.forEach(([left, width]) => {
    const bar = document.createElement("i");
    bar.style.left = left + "px";
    bar.style.width = width + "px";
    barcode.appendChild(bar);
  });

  /* ---------- Screen router ---------- */
  const TITLES = {
    signin: "CHECK OUT HERE",
    getcard: "GET A LIBRARY CARD",
    checkout: "CHECK OUT HERE",
    receipt: "THANK YOU",
  };
  let restartTimer = null;

  const show = (name) => {
    stage.dataset.screen = name;
    document.querySelectorAll(".screen").forEach((el) => (el.hidden = el.id !== "screen-" + name));
    $("bannerTitle").textContent = TITLES[name];
    if (name === "signin") resetSignIn();
  };
  document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));

  /* ---------- 1. Sign in ---------- */
  const card = $("cardInput");
  const pin = $("pinInput");
  const hints = { card: $("cardHint"), pin: $("pinHint") };

  const setError = (which, input, msg) => {
    input.classList.add("is-invalid");
    hints[which].textContent = msg;
    hints[which].classList.add("is-error");
  };
  const clearError = (which, input) => {
    input.classList.remove("is-invalid");
    hints[which].textContent = hints[which].dataset.default;
    hints[which].classList.remove("is-error");
  };
  const digitsOnly = (input) => (input.value = input.value.replace(/\D/g, ""));

  card.addEventListener("input", () => { digitsOnly(card); clearError("card", card); });
  pin.addEventListener("input", () => { digitsOnly(pin); clearError("pin", pin); });
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); pin.focus(); }
  });

  function resetSignIn() {
    card.value = ""; pin.value = "";
    clearError("card", card); clearError("pin", pin);
    card.focus();
  }

  $("signinForm").addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    if (!/^\d{10}$/.test(card.value)) {
      setError("card", card, "Please enter all 10 digits of your card number.");
      ok = false;
    }
    if (!/^\d{4}$/.test(pin.value)) {
      setError("pin", pin, "Your PIN is 4 digits. Try again, or ask a staff member.");
      ok = false;
    }
    if (!ok) { (card.classList.contains("is-invalid") ? card : pin).focus(); return; }

    if (card.value !== DEMO.card || pin.value !== DEMO.pin) {
      setError("pin", pin, "That card number and PIN don’t match. Please try again.");
      pin.value = ""; pin.focus();
      return;
    }
    startCheckout();
  });

  $("cancelBtn").addEventListener("click", resetSignIn);
  $("getCardBtn").addEventListener("click", () => show("getcard"));
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && stage.dataset.screen === "signin") resetSignIn();
  });

  /* High contrast toggle */
  $("hcBtn").addEventListener("click", () => {
    const on = stage.classList.toggle("hc");
    $("hcBtn").setAttribute("aria-pressed", String(on));
    $("hcLabel").textContent = on ? "Turn off High Contrast Mode" : "Turn on High Contrast Mode";
  });

  /* ---------- 3. Check out items ---------- */
  const CATALOG = [
    { title: "The Seattle Cookbook", author: "Hannah Ortiz", loan: 21 },
    { title: "Hiking the Cascades, 4th ed.", author: "Pat Nguyen", loan: 21 },
    { title: "Little Bear Goes to the Library", author: "M. Reyes", loan: 14 },
    { title: "Cedar & Salt (DVD)", author: "Northwest Films", loan: 7 },
  ];
  let checked = [];

  const fmt = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  function renderItems() {
    const list = $("itemList");
    list.innerHTML = "";
    checked.forEach((it) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      const t = document.createElement("div"); t.className = "t"; t.textContent = it.title;
      const a = document.createElement("div"); a.className = "a"; a.textContent = it.author;
      left.append(t, a);
      const d = document.createElement("div"); d.className = "d"; d.textContent = "Due " + fmt(it.loan);
      li.append(left, d);
      list.appendChild(li);
    });
    $("itemCount").textContent = checked.length;
    $("itemEmpty").hidden = checked.length > 0;
    $("doneBtn").disabled = checked.length === 0;
    $("scanBtn").disabled = checked.length >= CATALOG.length;
  }

  function startCheckout() {
    checked = [];
    renderItems();
    show("checkout");
  }

  $("scanBtn").addEventListener("click", () => {
    if (checked.length < CATALOG.length) { checked.push(CATALOG[checked.length]); renderItems(); }
  });
  $("signOutBtn").addEventListener("click", () => show("signin"));
  $("doneBtn").addEventListener("click", () => {
    const n = checked.length;
    $("receiptTitle").textContent = "You’re all set!";
    $("receiptLead").textContent = "Would you like a receipt?";
    $("dueNote").textContent = `${n} item${n === 1 ? "" : "s"} checked out. Earliest due date: ${fmt(Math.min(...checked.map((i) => i.loan)))}.`;
    $("receiptActions").hidden = false;
    $("restartNote").hidden = true;
    show("receipt");
  });

  /* ---------- 4. Receipt, then auto-return to sign in ---------- */
  const returnToStart = () => { clearInterval(restartTimer); show("signin"); };

  document.querySelectorAll("[data-receipt]").forEach((b) =>
    b.addEventListener("click", () => {
      const how = b.dataset.receipt;
      $("receiptTitle").textContent = "Thank you!";
      $("receiptLead").textContent =
        how === "print" ? "Your receipt is printing." :
        how === "email" ? "Your receipt is on its way to your email." :
        "No receipt — enjoy your items.";
      $("receiptActions").hidden = true;
      $("restartNote").hidden = false;
      let left = 8;
      $("countdown").textContent = left;
      clearInterval(restartTimer);
      restartTimer = setInterval(() => {
        left -= 1;
        $("countdown").textContent = left;
        if (left <= 0) returnToStart();
      }, 1000);
    })
  );
  $("restartBtn").addEventListener("click", returnToStart);

  show("signin");
})();
