// ============================================================
// Engine: maakt vragen uit de leerstof, verbetert antwoorden
// en analyseert fouten. Geen afhankelijkheden.
// ============================================================
(function () {
  "use strict";

  // ---------- hulpfuncties ----------
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rnd(arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const uniq = (arr) => [...new Set(arr)];
  const stripAccents = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const isVowelStart = (w) => /^[aeiouyhâàäéèêëîïôöûùü]/i.test(w);

  function norm(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[’‘`´]/g, "'")
      .replace(/[.,!?;:«»"]/g, " ")
      .replace(/'\s+/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  // "een buur(man)" -> ["een buur", "een buurman"]; "a / b" en "a, b" -> alternatieven
  function variants(text) {
    // " / " scheidt altijd alternatieven; een komma enkel bij losse woorden (niet in zinnen zoals "Moi, j'ai 10 ans.")
    const isSentence = /[.!?]$/.test(text.trim());
    const sep = isSentence ? /\s+\/\s+/ : /\s+\/\s+|,\s+/;
    const parts = text.split(sep).map((t) => t.trim()).filter(Boolean);
    const out = [];
    for (const p of parts) {
      if (p.includes("(")) {
        out.push(p.replace(/\(([^)]*)\)/g, "$1").replace(/\s+/g, " ").trim());
        out.push(p.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim());
      } else out.push(p);
    }
    return uniq(out);
  }

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 3;
    const d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }

  // lidwoord van een Frans naamwoord scheiden
  function splitArticle(fr) {
    const m = fr.trim().match(/^(?:(une|un|des|les|le|la)\s+|(l'))(.+)$/i);
    return m ? { art: (m[1] || m[2]).toLowerCase(), noun: m[3].trim() } : { art: "", noun: fr.trim() };
  }
  const NL_ART = /^(een|de|het)\s+/i;

  // ---------- verbeteren ----------
  // result: correct | accent | article | spelling | wrong
  function check(answer, q, level) {
    const a = norm(answer);
    if (!a) return { status: "wrong", points: 0 };
    const acc = q.accepted.map(norm);
    if (acc.includes(a)) return { status: "correct", points: 1 };
    const aS = stripAccents(a);
    if (acc.some((x) => stripAccents(x) === aS))
      return { status: "accent", points: level === "hard" ? 0 : 1 };
    if (q.isNoun && q.direction === "nl-fr") {
      const nounOnly = (s) => stripAccents(splitArticle(s).noun);
      if (acc.some((x) => nounOnly(x) === nounOnly(a)))
        return { status: "article", points: 0 };
    }
    if (acc.some((x) => x.length > 3 && lev(stripAccents(x), aS) <= 1))
      return { status: "spelling", points: 0 };
    return { status: "wrong", points: 0 };
  }

  // ---------- leerstof ophalen ----------
  function build(course) {
    const M = Object.fromEntries(course.missions.map((m) => [m.id, m]));
    const rule = (mid, gid) => (M[mid].grammatica || []).find((g) => g.id === gid) || {};

    const nounsFrom = (mid) => M[mid].woordenschat.filter((w) => w.soort === "nw");
    const allNouns = [...nounsFrom("M2"), ...nounsFrom("M3")]
      .filter((n) => !/musique/.test(n.fr))
      .map((n) => {
        const base = variants(n.fr)[0]; // "une télévision" of "une télé"
        const sp = splitArticle(n.fr.replace(/\(.*?\)/, ""));
        return { ...n, art: sp.art, noun: sp.noun.trim(), g: n.geslacht, full: base };
      });
    // naamwoorden die zowel m als v voorkomen (un/une élève, un/une prof) zijn dubbelzinnig voor lidwoordvragen
    const AMBIG = new Set(allNouns.filter((n) => allNouns.some((o) => o.noun === n.noun && o.g !== n.g)).map((n) => n.noun));
    const genderNouns = allNouns.filter((n) => !AMBIG.has(n.noun));
    const PLURAL_IRR ={ tableau: "tableaux", bureau: "bureaux", GSM: "GSM" };
    const plural = (noun) => PLURAL_IRR[noun] || noun + "s";

    const PRON_NL = { je: "ik", tu: "jij", il: "hij", elle: "zij (enkelvoud)", nous: "wij", vous: "jullie", ils: "zij (meervoud, jongens of gemengd)", elles: "zij (meervoud, enkel meisjes)" };
    const BOYS = ["Antoine", "Ivo", "Samuel", "Hamza", "Mounir", "Toon", "Ahmed", "Gabriel", "Rayan", "Tim", "Léo", "Matheo"];
    const GIRLS = ["Marie", "Nina", "Aya", "Claire", "Isabelle", "Élise", "Emma", "Sylvie", "Lina", "Zoé", "Clara", "Sara"];
    const subjectPool = () => {
      const b = shuffle(BOYS), g = shuffle(GIRLS);
      return [
        { s: b[0], p: "il" }, { s: g[0], p: "elle" }, { s: "papa", p: "il" }, { s: "la prof", p: "elle" },
        { s: `${g[0]} et ${g[1]}`, p: "elles" }, { s: `${b[0]} et ${b[1]}`, p: "ils" },
        { s: `${b[0]} et ${g[0]}`, p: "ils" }, { s: `${g[1]} et moi`, p: "nous" },
        { s: `${b[1]} et toi`, p: "vous" }, { s: `les élèves`, p: "ils" },
      ];
    };

    const ETRE = M.M1.grammatica.find((g) => g.id === "etre").vervoeging;
    const etreForm = (p) => ({ je: "suis", tu: "es", il: "est", elle: "est", nous: "sommes", vous: "êtes", ils: "sont", elles: "sont" })[p];
    const ER_END = { je: "e", tu: "es", il: "e", elle: "e", nous: "ons", vous: "ez", ils: "ent", elles: "ent" };
    const ER_VERBS = ["aimer", "chanter", "danser", "écouter", "jouer", "regarder", "téléphoner"];
    const erForm = (v, p) => v.slice(0, -2) + ER_END[p];
    const withPron = (p, form) => (p === "je" && isVowelStart(form) ? "j'" + form : p + " " + form);
    const PRONS = ["je", "tu", "il", "elle", "nous", "vous", "ils", "elles"];

    // Een "unit" is een kleinste selecteerbaar onderdeel.
    const units = [];
    const addVocab = (mission, id, label, items, opts = {}) =>
      units.push({ id, mission, kind: "vocab", label, items, page: opts.page || (items[0] && items[0].p), isSentence: !!opts.sentence, defaultOn: opts.defaultOn !== false, rule: opts.rule || "" });
    const addGram = (mission, id, label, gen, r, opts = {}) =>
      units.push({ id, mission, kind: "gram", label, gen, page: r.p, rule: r.regel || "", defaultOn: opts.defaultOn !== false });

    // ---- M1 ----
    const m1 = M.M1;
    addVocab("M1", "m1-zinnen", "Klaar om te spreken (zinnen)", m1.zinnen, { sentence: true });
    addVocab("M1", "m1-woorden", "Woorden (être, hoe, wie, ja, nee, van…)", m1.woordenschat);
    addVocab("M1", "m1-getallen", "Getallen 0–12", m1.getallen.map((g) => ({ fr: g.fr, nl: String(g.n), p: 3, n: g.n })), { page: 3 });
    addVocab("M1", "m1-steden", "Belgische steden in het Frans", m1.steden.map((s) => ({ ...s, p: 3 })), { page: 3 });
    addGram("M1", "g-pronoms", "Persoonlijke voornaamwoorden", genPronoms, rule("M1", "pronoms-personnels"));
    addGram("M1", "g-etre", "Vervoeging être", genEtre, rule("M1", "etre"));
    addGram("M1", "g-de", "de of d'", genDe, rule("M1", "de-d"));
    addGram("M1", "g-rekenen", "Rekenen in het Frans (0–12)", genSums, { p: 4, regel: "Ken de getallen van 0 tot 12." });

    // ---- M2 ----
    const m2 = M.M2;
    addVocab("M2", "m2-nw", "Zelfstandige naamwoorden (klas)", m2.woordenschat.filter((w) => w.soort === "nw"));
    addVocab("M2", "m2-andere", "Andere woorden (avec, quoi, trop, vite, donner)", m2.woordenschat.filter((w) => w.soort !== "nw"));
    addVocab("M2", "m2-zinnen", "Klaar om te spreken (zinnen)", m2.zinnen, { sentence: true });
    addVocab("M2", "m2-extra", "Extra: schoolgerief uit de leestekst (p.24)", m2.extra_woordenschat.woorden.map((w) => ({ ...w, soort: "nw", p: 24 })), { page: 24, defaultOn: false });
    addGram("M2", "g-vous", "tu of vous (jij / jullie / u)", genVous, rule("M2", "vous"));
    addGram("M2", "g-indef", "Onbepaalde lidwoorden un / une / des", genIndef, rule("M2", "articles-indefinis"));
    addGram("M2", "g-pluriel", "Het meervoud", genPluriel, rule("M2", "pluriel"));
    addGram("M2", "g-cest", "C'est / Ce sont", genCest, rule("M2", "cest-cesont"));

    // ---- M3 ----
    const m3 = M.M3;
    addVocab("M3", "m3-nw", "Zelfstandige naamwoorden (vrije tijd)", m3.woordenschat.filter((w) => w.soort === "nw"));
    addVocab("M3", "m3-ww", "Werkwoorden", m3.woordenschat.filter((w) => w.soort === "ww"));
    addVocab("M3", "m3-dagen", "Dagen van de week", m3.woordenschat.filter((w) => w.soort === "dag"));
    addVocab("M3", "m3-zinnen", "Klaar om te spreken (zinnen)", m3.zinnen, { sentence: true });
    addVocab("M3", "m3-extra", "Extra: activiteiten uit de leestekst (p.26)", m3.extra_woordenschat.woorden.map((w) => ({ ...w, p: 26 })), { page: 26, defaultOn: false });
    addGram("M3", "g-aimerinf", "J'aime + infinitief", genAimerInf, rule("M3", "aimer-infinitif"));
    addGram("M3", "g-def", "Bepaalde lidwoorden le / la / l' / les", genDef, rule("M3", "articles-definis"));
    addGram("M3", "g-au", "au, à la, à l', aux", genAu, { p: 32, regel: "à + le = au; à + la = à la; à + l' = à l'; à + les = aux." });
    addGram("M3", "g-aimer", "Vervoeging aimer", genAimer, rule("M3", "aimer"));
    addGram("M3", "g-er", "Werkwoorden op -ER", genER, { p: 34, regel: "Stam (knip -ER weg) + uitgang: je -e, tu -es, il/elle -e, nous -ons, vous -ez, ils/elles -ent. je wordt j' voor een klinker." });

    // ---- Destination A ----
    const da = M.DA.faits_divers;
    addVocab("DA", "da-prov", "Provincies (cultuur, p.38)", da.provincies.map((x) => ({ ...x, p: 38 })), { page: 38, defaultOn: false });
    addVocab("DA", "da-steden", "Vlaamse steden in het Frans (p.38)", da.steden.map((x) => ({ ...x, p: 38 })), { page: 38, defaultOn: false });

    // ---------- vraag-bouwers ----------
    function mcOrText(level, preferMc) {
      if (level === "easy") return "mc";
      if (level === "hard") return "text";
      return preferMc || Math.random() < 0.5 ? "mc" : "text";
    }
    function mcOptions(correct, pool, n = 4) {
      const others = shuffle(uniq(pool.filter((x) => norm(x) !== norm(correct)))).slice(0, n - 1);
      return shuffle([correct, ...others]);
    }

    function vocabQuestion(unit, item, dir, level) {
      const sentence = unit.isSentence;
      const isNoun = item.soort === "nw";
      const mode = mcOrText(level, sentence && level !== "hard");
      const pool = unit.items.length >= 4 ? unit.items : unit.items.concat(units.filter((u) => u.kind === "vocab" && u.mission === unit.mission).flatMap((u) => u.items));
      let q;
      if (dir === "nl-fr") {
        q = {
          instruction: isNoun ? "Vertaal naar het Frans (met lidwoord)" : "Vertaal naar het Frans",
          prompt: item.nl, accepted: variants(item.fr), answerShown: item.fr,
          options: mcOptions(variants(item.fr)[0], pool.map((x) => variants(x.fr)[0])),
        };
        if (isNoun && level !== "hard") {
          // in normaal ook goed zonder (de) bij "(le) lundi"-achtige gevallen: al in variants
        }
      } else {
        const nl = variants(item.nl);
        const acc = uniq(nl.concat(nl.map((x) => x.replace(NL_ART, ""))));
        q = {
          instruction: "Vertaal naar het Nederlands",
          prompt: item.fr, accepted: acc, answerShown: item.nl,
          options: mcOptions(nl[0], pool.map((x) => variants(x.nl)[0])),
        };
      }
      if (unit.id === "m1-getallen") {
        q.instruction = dir === "nl-fr" ? "Schrijf het getal in het Frans" : "Welk getal is dit?";
      }
      q.hint = dir === "nl-fr" ? item.hint_nl : item.hint_fr;
      return { ...q, kind: "vocab", unitId: unit.id, direction: dir, isNoun, mode, page: item.p, rule: unit.rule, key: unit.id + ":" + item.fr + ":" + dir };
    }

    function gq(unit, o) {
      return { kind: "gram", unitId: unit.id, page: o.page || unit.page, rule: unit.rule, direction: null, isNoun: false, key: unit.id + ":" + o.prompt, ...o };
    }

    // Elke generator krijgt optioneel een "case" c: dan wordt precies dat geval gevraagd (eindtoets-modus).
    function genPronoms(unit, level, c) {
      if (c ? c.pron : Math.random() < 0.3) {
        const p = c ? c.pron : pick(PRONS);
        return gq(unit, { instruction: "Welk persoonlijk voornaamwoord is dit in het Frans?", prompt: PRON_NL[p], accepted: [p], answerShown: p, mode: mcOrText(level), options: shuffle([p, ...shuffle(PRONS.filter((x) => x !== p)).slice(0, 3)]) });
      }
      const pool = subjectPool();
      const s = c ? pool[c.subj] : pick(pool);
      return gq(unit, { instruction: "Welk voornaamwoord past?", prompt: s.s + " → ?", accepted: [s.p], answerShown: s.p, mode: mcOrText(level, true), options: ["il", "elle", "ils", "elles", "nous", "vous"] });
    }

    function genEtre(unit, level, c) {
      const ctx = pick(["de Bruxelles", "d'Anvers", "de Namur", "de Gand", "d'Arlon", "de Liège", "d'Ostende", "de Bruges"]);
      let subj, p;
      if (c) { p = c.p; subj = p; }
      else if (Math.random() < 0.5) { p = pick(PRONS); subj = p; } else { const s = pick(subjectPool()); subj = s.s; p = s.p; }
      const form = etreForm(p);
      const display = subj.charAt(0).toUpperCase() + subj.slice(1);
      return gq(unit, { instruction: "Vul de juiste vorm van être in", prompt: `${display} ___ ${ctx}.`, accepted: [form], answerShown: form, mode: mcOrText(level), options: ["suis", "es", "est", "sommes", "êtes", "sont"], verbForm: true });
    }

    const DE_CITIES = M.M1.steden.map((s) => s.fr).concat(["Ostende", "Esneux", "Ath", "Ottignies", "Pepinster", "Durbuy", "Charleroi", "Avignon"]);
    function genDe(unit, level, c) {
      const city = c ? c.city : pick(DE_CITIES);
      const ans = isVowelStart(city) ? "d'" : "de";
      return gq(unit, { instruction: "de of d'?", prompt: `Je suis ___ ${city}.`, accepted: ans === "d'" ? ["d'", "d"] : ["de"], answerShown: ans, mode: "mc", options: ["de", "d'"] });
    }

    function genSums(unit, level) {
      const G = M.M1.getallen;
      const a = rnd(13), b = rnd(13 - a), plus = Math.random() < 0.7;
      let x = a, y = b, r = a + b, op = "+";
      if (!plus) { x = a + b; y = b; r = a; op = "−"; }
      const ans = G[r].fr;
      return gq(unit, { instruction: "Reken uit en schrijf het resultaat in het Frans", prompt: `${G[x].fr} ${op} ${G[y].fr} =`, accepted: [ans], answerShown: ans, mode: mcOrText(level), options: mcOptions(ans, G.map((g) => g.fr)) });
    }

    const VOUS_T = [
      { p: "Je spreekt je vriend aan: \"Wie ben jij?\"", a: "Tu es qui?", o: ["Tu es qui?", "Vous êtes qui?"] },
      { p: "Je spreekt een onbekende mevrouw aan: \"Wie bent u?\"", a: "Vous êtes qui?", o: ["Tu es qui?", "Vous êtes qui?"] },
      { p: "Je spreekt twee kinderen aan: \"Zijn jullie van Luik?\"", a: "Vous êtes de Liège?", o: ["Tu es de Liège?", "Vous êtes de Liège?"] },
      { p: "Je vraagt de juf iets: \"Wat is het, alstublieft?\"", a: "C'est quoi, s'il vous plaît?", o: ["C'est quoi, s'il te plaît?", "C'est quoi, s'il vous plaît?"] },
      { p: "Je vraagt je buur iets: \"Wat is het, alsjeblieft?\"", a: "C'est quoi, s'il te plaît?", o: ["C'est quoi, s'il te plaît?", "C'est quoi, s'il vous plaît?"] },
      { p: "Hoe zeg je \"jullie\" in het Frans?", a: "vous", o: ["tu", "vous", "nous"] },
      { p: "Hoe zeg je de beleefde vorm \"u\" in het Frans?", a: "vous", o: ["tu", "vous", "nous"] },
    ];
    function genVous(unit, level, c) {
      const t = c ? VOUS_T[c.i] : pick(VOUS_T);
      return gq(unit, { instruction: "tu of vous? Kies de juiste vraag", prompt: t.p, accepted: [t.a], answerShown: t.a, mode: "mc", options: shuffle(t.o) });
    }

    function genIndef(unit, level, c) {
      const pl = c ? !!c.pl : Math.random() < 0.3;
      const n = c && c.n ? c.n : pick(pl ? allNouns : genderNouns);
      const ans = pl ? "des" : n.g === "m" ? "un" : "une";
      const word = pl ? plural(n.noun) : n.noun;
      return gq(unit, { instruction: "Vul het onbepaald lidwoord in: un, une of des", prompt: `___ ${word}`, accepted: [ans], answerShown: `${ans} ${word}`, mode: mcOrText(level, true), options: ["un", "une", "des"], page: n.p });
    }

    const PLURAL_NOUNS = allNouns.filter((x) => !/télé/.test(x.noun));
    function genPluriel(unit, level, c) {
      const n = c ? c.n : pick(PLURAL_NOUNS);
      const tpl = pick([["", ""], ["C'est ", "Ce sont "], ["Il y a ", "Il y a "], ["Voici ", "Voici "]]);
      const sing = `${tpl[0]}${n.art} ${n.noun}`.trim();
      const pl = `${tpl[1]}des ${plural(n.noun)}`;
      const wrongs = [`${tpl[1]}des ${n.noun}`, `${tpl[1]}les ${plural(n.noun)}`, `${tpl[0]}des ${plural(n.noun)}`].map((s) => s.trim());
      return gq(unit, { instruction: "Zet in het meervoud", prompt: sing + (tpl[0] ? "." : ""), accepted: [pl], answerShown: pl, mode: mcOrText(level), options: shuffle(uniq([pl, ...wrongs])) });
    }

    function genCest(unit, level, c) {
      const t = c ? c.t : Math.random() < 0.3 ? pick(["qui", "quoi"]) : pick(["cest", "cesont"]);
      if (t === "qui" || t === "quoi") {
        const person = t === "qui";
        const n = pick(allNouns.filter((x) => (/élève|prof|voisin|ami/.test(x.noun)) === person));
        const ans = person ? "C'est qui?" : "C'est quoi?";
        return gq(unit, { instruction: "Welke vraag hoort bij het antwoord?", prompt: `▸ C'est ${n.full}.`, accepted: [ans], answerShown: ans, mode: "mc", options: ["C'est qui?", "C'est quoi?"] });
      }
      const n = pick(allNouns);
      const pl = t === "cesont";
      const ans = pl ? "Ce sont" : "C'est";
      const rest = pl ? `des ${plural(n.noun)}` : n.full;
      return gq(unit, { instruction: "C'est of Ce sont?", prompt: `___ ${rest}.`, accepted: [ans], answerShown: `${ans} ${rest}.`, mode: mcOrText(level, true), options: ["C'est", "Ce sont"] });
    }

    // kandidaten per bepaald lidwoord (zonder dubbelzinnige un/une élève/prof in het enkelvoud)
    const DEF_POOL = {
      le: genderNouns.filter((n) => n.g === "m" && !isVowelStart(n.noun)),
      la: genderNouns.filter((n) => n.g === "v" && !isVowelStart(n.noun)),
      "l'": allNouns.filter((n) => isVowelStart(n.noun)),
      les: allNouns,
    };
    function genDef(unit, level, c) {
      const ans = c ? c.art : (() => { const pl = Math.random() < 0.3; if (pl) return "les"; return pick(["le", "la", "l'"]); })();
      const n = pick(DEF_POOL[ans]);
      const pl = ans === "les";
      const word = pl ? plural(n.noun) : n.noun;
      const prompt = Math.random() < 0.4 && !pl && !AMBIG.has(n.noun) ? `${n.full} → ___ ${word}` : `___ ${word}`;
      return gq(unit, { instruction: "Vul het bepaald lidwoord in: le, la, l' of les", prompt, accepted: ans === "l'" ? ["l'", "l"] : [ans], answerShown: (ans === "l'" ? "l'" : ans + " ") + word, mode: mcOrText(level, true), options: ["le", "la", "l'", "les"] });
    }

    const isPerson = (n) => /élève|prof|voisin|ami/.test(n.noun);
    const isThing = (n) => /cinéma|école|radio|ordinateur|télé|tableau|page/.test(n.noun);
    const AU_POOL = {
      au: genderNouns.filter((n) => n.g === "m" && !isVowelStart(n.noun) && (isPerson(n) || isThing(n))),
      "à la": genderNouns.filter((n) => n.g === "v" && !isVowelStart(n.noun) && (isPerson(n) || isThing(n))),
      "à l'": allNouns.filter((n) => isVowelStart(n.noun) && (isPerson(n) || isThing(n))),
      aux: allNouns.filter(isPerson),
    };
    function genAu(unit, level, c) {
      const ans = c ? c.ans : pick(["au", "à la", "à l'", "aux"]);
      const n = pick(AU_POOL[ans]);
      const pl = ans === "aux";
      const word = pl ? plural(n.noun) : n.noun;
      const start = isPerson(n) ? pick(["Je téléphone", "Nous téléphonons", "La prof donne un livre", "Il dit bonjour"]) :
        /cinéma|école/.test(n.noun) ? pick(["Les élèves sont", "Nous sommes", "Je suis"]) :
        /radio|télé/.test(n.noun) ? pick(["J'écoute des chansons", "Je regarde un film"]) : pick(["Timothy joue", "Les exercices sont", "Le texte est"]);
      return gq(unit, { instruction: "Vul in: au, à la, à l' of aux", prompt: `${start} ___ ${word}.`, accepted: [ans, ans.replace("'", "")], answerShown: `${start} ${ans}${ans.endsWith("'") ? "" : " "}${word}.`, mode: mcOrText(level, true), options: ["au", "à la", "à l'", "aux"] });
    }

    const INF_VERBS = ER_VERBS.filter((x) => x !== "aimer");
    function genAimerInf(unit, level, c) {
      const v = c ? c.v : pick(INF_VERBS);
      const s = pick([{ s: "J'aime", p: "je" }, { s: "Tu aimes", p: "tu" }, { s: "Nous aimons", p: "nous" }, { s: "Elles aiment", p: "elles" }]);
      const obj = { chanter: "des chansons", danser: "avec un ami", écouter: "la radio", jouer: "au basket", regarder: "la télé", téléphoner: "à une amie" }[v];
      const opts = uniq([v, erForm(v, "je"), erForm(v, "nous"), erForm(v, "vous")]);
      return gq(unit, { instruction: `Vul de juiste vorm van ${v} in`, prompt: `${s.s} ___ ${obj}.`, accepted: [v], answerShown: `${s.s} ${v} ${obj}.`, mode: mcOrText(level, true), options: shuffle(opts), verbForm: true });
    }

    function conjQuestion(unit, level, v, forcedP) {
      let p, subj;
      if (forcedP) { p = forcedP; subj = null; }
      else if (Math.random() < 0.6) { p = pick(PRONS); subj = null; } else { const s = pick(subjectPool()); p = s.p; subj = s.s; }
      const form = erForm(v, p);
      const all = uniq(PRONS.map((x) => erForm(v, x)));
      if (subj) {
        return gq(unit, { instruction: `Vervoeg ${v}`, prompt: `${subj.charAt(0).toUpperCase() + subj.slice(1)} ___ (${v})`, accepted: [form], answerShown: `${subj} ${form}`, mode: mcOrText(level), options: shuffle(all), verbForm: true });
      }
      const full = withPron(p, form);
      return gq(unit, { instruction: `Vervoeg ${v} (schrijf het voornaamwoord mee)`, prompt: `${p} … (${v})`, accepted: [full, form], answerShown: full, mode: mcOrText(level), options: shuffle(all.map((f) => withPron(p, f))), verbForm: true });
    }
    function genAimer(unit, level, c) { return conjQuestion(unit, level, "aimer", c && c.p); }
    function genER(unit, level, c) { return c ? conjQuestion(unit, level, c.v, c.p) : conjQuestion(unit, level, pick(INF_VERBS)); }

    // ---------- volledige dekking per grammatica-onderdeel (eindtoets) ----------
    const COVERAGE = {
      "g-pronoms": () => [...PRONS.map((pron) => ({ pron })), ...subjectPool().map((_, subj) => ({ subj }))],
      "g-etre": () => PRONS.map((p) => ({ p })),
      "g-de": () => [...DE_CITIES.filter(isVowelStart).slice(0, 3), ...DE_CITIES.filter((x) => !isVowelStart(x)).slice(0, 3)].map((city) => ({ city })),
      "g-rekenen": () => [{}, {}, {}, {}],
      "g-vous": () => VOUS_T.map((_, i) => ({ i })),
      "g-indef": () => [...genderNouns.map((n) => ({ n })), ...shuffle(allNouns).slice(0, 3).map((n) => ({ n, pl: true }))],
      "g-pluriel": () => {
        const irr = PLURAL_NOUNS.filter((n) => PLURAL_IRR[n.noun]);
        return [...irr, ...shuffle(PLURAL_NOUNS.filter((n) => !PLURAL_IRR[n.noun])).slice(0, 4)].map((n) => ({ n }));
      },
      "g-cest": () => ["qui", "quoi", "cest", "cest", "cesont", "cesont"].map((t) => ({ t })),
      "g-aimerinf": () => INF_VERBS.map((v) => ({ v })),
      "g-def": () => ["le", "le", "la", "la", "l'", "l'", "les", "les"].map((art) => ({ art })),
      "g-au": () => ["au", "au", "à la", "à la", "à l'", "à l'", "aux", "aux"].map((ans) => ({ ans })),
      "g-aimer": () => PRONS.map((p) => ({ p })),
      "g-er": () => INF_VERBS.flatMap((v, i) => [{ v, p: PRONS[(2 * i) % 8] }, { v, p: PRONS[(2 * i + 1) % 8] }]),
    };
    units.forEach((u) => { if (u.kind === "gram") u.cases = COVERAGE[u.id]; });

    // ---------- toets samenstellen ----------
    // "Alle": elk woord/elke zin precies één keer + een vast aantal vragen per grammatica-onderdeel
    const GRAM_PER_UNIT_ALL = 6;
    function countAll(settings) {
      const sel = units.filter((u) => settings.units.includes(u.id));
      const mult = settings.dir === "both" && settings.bothDirs ? 2 : 1;
      return sel.reduce((s, u) => s + (u.kind === "vocab" ? u.items.length * mult : u.cases ? u.cases().length : GRAM_PER_UNIT_ALL), 0);
    }
    function makeAllQuiz(settings, sel) {
      const qs = [];
      for (const u of sel) {
        if (u.kind === "vocab") {
          for (const item of u.items) {
            const dirs = settings.dir === "both" ? (settings.bothDirs ? ["nl-fr", "fr-nl"] : [Math.random() < 0.5 ? "nl-fr" : "fr-nl"]) : [settings.dir];
            for (const dir of dirs) qs.push({ ...vocabQuestion(u, item, dir, settings.level), unitLabel: u.label, mission: u.mission });
          }
        } else {
          if (u.cases) {
            const seen = new Set();
            for (const c of u.cases()) {
              let q, tries = 0;
              do { q = u.gen(u, settings.level, c); } while (seen.has(q.key) && ++tries < 15);
              seen.add(q.key);
              qs.push({ ...q, unitLabel: u.label, mission: u.mission, coverage: true });
            }
            continue;
          }
          const seen = new Set();
          for (let i = 0, guard = 0; i < GRAM_PER_UNIT_ALL && guard < 200; guard++) {
            const q = u.gen(u, settings.level);
            if (seen.has(q.key)) continue;
            seen.add(q.key); i++;
            qs.push({ ...q, unitLabel: u.label, mission: u.mission });
          }
        }
      }
      qs.forEach((q) => { if (q.mode === "mc" && (!q.options || q.options.length < 2)) q.mode = "text"; });
      return shuffle(qs);
    }

    function makeQuiz(settings) {
      const sel = units.filter((u) => settings.units.includes(u.id));
      if (!sel.length) return [];
      if (settings.count === "all") return makeAllQuiz(settings, sel);
      const questions = [];
      const seen = new Set();
      let guard = 0;
      // per unit een geschudde stapel items zodat woorden niet snel herhalen
      const decks = {};
      while (questions.length < settings.count && guard++ < settings.count * 40) {
        const u = sel[questions.length % sel.length === 0 ? rnd(sel.length) : rnd(sel.length)];
        let q;
        if (u.kind === "vocab") {
          if (!decks[u.id] || !decks[u.id].length) decks[u.id] = shuffle(u.items);
          const item = decks[u.id].pop();
          const dir = settings.dir === "both" ? (Math.random() < 0.5 ? "nl-fr" : "fr-nl") : settings.dir;
          q = vocabQuestion(u, item, dir, settings.level);
        } else {
          q = u.gen(u, settings.level);
        }
        if (seen.has(q.key) && guard < settings.count * 30) continue;
        seen.add(q.key);
        q.unitLabel = u.label; q.mission = u.mission;
        if (q.mode === "mc" && (!q.options || q.options.length < 2)) q.mode = "text";
        questions.push(q);
      }
      return shuffle(questions);
    }

    return { units, makeQuiz, check, countAll };
  }

  // ---------- foutanalyse ----------
  function analyse(results, units, missionTitles) {
    const total = results.length;
    const points = results.reduce((s, r) => s + r.points, 0);
    const byUnit = {};
    for (const r of results) {
      const k = r.q.unitId;
      byUnit[k] = byUnit[k] || { label: r.q.unitLabel, mission: r.q.mission, kind: r.q.kind, page: r.q.page, rule: r.q.rule, n: 0, ok: 0 };
      byUnit[k].n++; byUnit[k].ok += r.points;
    }
    const mistakes = results.filter((r) => r.status !== "correct");
    const count = (st) => results.filter((r) => r.status === st).length;
    const c = [];
    const pct = total ? Math.round((points / total) * 100) : 0;

    if (pct >= 90) c.push({ type: "good", text: `Knap! ${pct}% juist. Deze leerstof zit goed.` });
    else if (pct >= 70) c.push({ type: "ok", text: `${pct}% juist: een goede basis, maar er zijn nog enkele werkpunten.` });
    else c.push({ type: "bad", text: `${pct}% juist: deze leerstof moet nog grondig herhaald worden.` });

    const weak = Object.values(byUnit).filter((u) => u.n >= 2 && u.ok / u.n < 0.7).sort((a, b) => a.ok / a.n - b.ok / b.n);
    for (const u of weak.slice(0, 4))
      c.push({ type: "bad", text: `Werkpunt: <b>${u.label}</b> <small>(${u.mission})</small> (${Math.round((u.ok / u.n) * 100)}%). Herhaal p.${u.page}${u.rule ? ` — ${u.rule}` : ""}` });
    const strong = Object.values(byUnit).filter((u) => u.n >= 2 && u.ok === u.n);
    if (strong.length) c.push({ type: "good", text: `Foutloos: ${strong.map((u) => u.label).join(", ")}.` });

    const acc = count("accent");
    if (acc >= 2) c.push({ type: "ok", text: `${acc}× een accent vergeten of verkeerd (é, è, ê, à, ç…). De woorden ken je, let op de schrijfwijze.` });
    const art = count("article");
    if (art >= 1) c.push({ type: "bad", text: `${art}× het juiste woord, maar het verkeerde lidwoord. Leer elk naamwoord samen met un/une (p.19): dan ken je ook het geslacht.` });
    const sp = count("spelling");
    if (sp >= 2) c.push({ type: "ok", text: `${sp}× bijna juist (één letter fout). Schrijf deze woorden een paar keer over.` });

    const verbErr = mistakes.filter((r) => r.q.verbForm).length;
    if (verbErr >= 2) c.push({ type: "bad", text: `${verbErr} fouten bij werkwoordsvormen. Tip: stam + uitgang (-e, -es, -e, -ons, -ez, -ent). être is onregelmatig: suis, es, est, sommes, êtes, sont.` });

    const dirStat = (d) => { const rs = results.filter((r) => r.q.direction === d); return rs.length ? { n: rs.length, ok: rs.reduce((s, r) => s + r.points, 0) } : null; };
    const nf = dirStat("nl-fr"), fn = dirStat("fr-nl");
    if (nf && fn && nf.n >= 3 && fn.n >= 3) {
      const a = nf.ok / nf.n, b = fn.ok / fn.n;
      if (b - a > 0.2) c.push({ type: "ok", text: `Frans → Nederlands lukt beter (${Math.round(b * 100)}%) dan Nederlands → Frans (${Math.round(a * 100)}%). Je herkent de woorden, maar kan ze nog niet zelf schrijven. Oefen extra in de richting NL → FR.` });
      else if (a - b > 0.2) c.push({ type: "ok", text: `Nederlands → Frans lukt beter dan Frans → Nederlands. Lees de Franse woorden hardop en vertaal ze.` });
    }
    const typed = results.filter((r) => r.q.mode === "text"), mc = results.filter((r) => r.q.mode === "mc");
    if (typed.length >= 4 && mc.length >= 4) {
      const t = typed.reduce((s, r) => s + r.points, 0) / typed.length, m = mc.reduce((s, r) => s + r.points, 0) / mc.length;
      if (m >= 0.6 && m - t > 0.25) c.push({ type: "ok", text: `Meerkeuze gaat vlot (${Math.round(m * 100)}%), zelf typen minder (${Math.round(t * 100)}%). Volgende stap: oefen op 'Moeilijk'.` });
    }
    if (!mistakes.length) c.push({ type: "good", text: "Geen enkele fout. Probeer eens een hoger niveau of meer vragen." });

    return { total, points, pct, byUnit, mistakes, conclusions: c };
  }

  window.Engine = { build, analyse, norm, variants };
})();
