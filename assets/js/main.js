(() => {
  "use strict";

  /* ---------- Theme toggle ---------- */
  const applyTheme = (t) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("pulltogether-theme", t);
    } catch (e) {
      /* ignore */
    }
  };

  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      applyTheme(cur);
    });
  }

  /* ---------- Mobile nav ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
    nav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => nav.classList.remove("open"))
    );
  }

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => io.observe(el));
    // 兜底：若观察器在 1.5s 内未触发（如部分嵌入/无头环境），
    // 让首屏内元素直接显现，避免内容永久隐藏。
    setTimeout(() => {
      revealEls.forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add("in");
        }
      });
    }, 1500);
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Typewriter terminal ---------- */
  const term = document.querySelector("[data-type]");
  if (term) {
    const body = term.querySelector(".term-body") || term;
    const lines = Array.from(term.querySelectorAll(".ln")).map(
      (el) => el.innerHTML
    );
    body.innerHTML = "";

    const cursor = document.createElement("span");
    cursor.className = "cursor";
    cursor.textContent = "";

    let lineIdx = 0;
    let charIdx = 0;
    let speed = 14;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const type = async () => {
      while (lineIdx < lines.length) {
        const line = document.createElement("span");
        line.className = "ln";
        body.appendChild(line);
        body.appendChild(cursor);

        const text = lines[lineIdx];
        while (charIdx < text.length) {
          const chunk = text[charIdx];
          if (chunk === "<") {
            const close = text.indexOf(">", charIdx);
            line.innerHTML += text.slice(charIdx, close + 1);
            charIdx = close + 1;
          } else {
            line.innerHTML += chunk.replace(/&/g, "&amp;");
            charIdx++;
          }
          if (speed > 2 && Math.random() < 0.05) await sleep(45);
          else if (speed > 2 && Math.random() < 0.12) await sleep(0);
          else await sleep(speed);
        }
        lineIdx++;
        charIdx = 0;
        await sleep(260);
        line.classList.add("done");
      }
      cursor.remove();
    };

    let typingStarted = false;
    const startTyping = () => {
      if (typingStarted) return;
      typingStarted = true;
      type();
    };

    const io2 = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          startTyping();
          io2.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io2.observe(term);
    setTimeout(startTyping, 900);
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Mailto form ---------- */
  document.querySelectorAll("form[data-mailto]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const to = form.getAttribute("data-mailto");
      const subject = encodeURIComponent(form.subject.value || "");
      const body = encodeURIComponent(form.body.value || "");
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  });

  /* ---------- Code highlighting ---------- */
  const escapeHtml = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  document.querySelectorAll("pre code[data-lang]").forEach((block) => {
    const lang = (block.dataset.lang || "text").toLowerCase();
    const text = escapeHtml(block.textContent);
    let html = text;

    if (lang === "json") {
      html = text.replace(
        /("(?:[^"\\]|\\.)*")(\s*:)|("(?:[^"\\]|\\.)*")|\b(true|false|null)\b|\b(\d+(?:\.\d+)?)\b/g,
        (m, key, colon, str, kw, num) => {
          if (key) return `<span class="k">${key}</span>${colon}`;
          if (str) return `<span class="s">${str}</span>`;
          if (kw || num) return `<span class="n">${kw || num}</span>`;
          return m;
        }
      );
    } else if (lang === "python") {
      html = text.replace(
        /(#[^\n]*)|(f?"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@\w+)|\b(def|class|return|import|from|pass|if|elif|else|for|while|in|not|and|or|None|True|False|self|async|await)\b/g,
        (m, comment, str, decor, kw) => {
          if (comment) return `<span class="dim">${comment}</span>`;
          if (str) return `<span class="s">${str}</span>`;
          if (decor) return `<span class="n">${decor}</span>`;
          if (kw) return `<span class="k">${kw}</span>`;
          return m;
        }
      );
    }

    block.innerHTML = html;
  });

  /* ---------- Project modal ---------- */
  const projects = window.PULLTOGETHER_PROJECTS || {};
  const modalOverlay = document.getElementById("project-modal");

  if (modalOverlay) {
    const modal = modalOverlay.querySelector(".modal");
    const closeBtn = modalOverlay.querySelector(".modal-close");
    const modalId = modalOverlay.querySelector("#modal-id");
    const modalTitle = modalOverlay.querySelector("#modal-title");
    const modalSub = modalOverlay.querySelector("#modal-sub");
    const modalTags = modalOverlay.querySelector("#modal-tags");
    const modalSpecs = modalOverlay.querySelector("#modal-specs");
    const modalLinks = modalOverlay.querySelector("#modal-links");
    const modalDesc = modalOverlay.querySelector("#modal-desc");
    let lastFocused = null;

    const closeModal = () => {
      if (!modalOverlay.classList.contains("open")) return;
      modalOverlay.classList.remove("open");
      document.body.classList.remove("modal-open");
      if (lastFocused) lastFocused.focus();
    };

    const openModal = (key) => {
      const data = projects[key];
      if (!data) return;

      lastFocused = document.activeElement;
      modalId.textContent = data.id || "";
      modalTitle.textContent = data.title || "";
      modalSub.textContent = data.sub || "";
      modalTags.innerHTML = (data.tags || []).join("");
      modalTags.style.display = data.tags && data.tags.length ? "" : "none";

      modalSpecs.innerHTML = (data.specs || [])
        .map(
          (pair) =>
            `<li><span>${pair[0]}</span><span class="val">${pair[1]}</span></li>`
        )
        .join("");

      modalLinks.querySelectorAll("[data-kind]").forEach((link) => {
        const href = (data.links || {})[link.dataset.kind];
        if (href) {
          link.href = href;
          link.style.display = "";
          if (link.dataset.kind === "docs") {
            link.removeAttribute("target");
          } else {
            link.setAttribute("target", "_blank");
          }
        } else {
          link.removeAttribute("href");
          link.style.display = "none";
        }
      });

      modalDesc.innerHTML = (data.desc || [])
        .map((p) => `<p>${p}</p>`)
        .join("");

      modalOverlay.classList.add("open");
      document.body.classList.add("modal-open");
      modal.scrollTop = 0;
      closeBtn.focus();
    };

    closeBtn.addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalOverlay.classList.contains("open")) {
        closeModal();
      }
    });

    document.querySelectorAll("[data-project]").forEach((card) => {
      const show = () => openModal(card.dataset.project);
      card.addEventListener("click", show);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          show();
        }
      });
    });
  }
})();
