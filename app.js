/* Working Bedrock structure worldgen pack builder.
   Outputs correct folders:
   - structures/
   - features/
   - feature_rules/
*/

const drop = document.getElementById("drop");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");
const structuresList = document.getElementById("structuresList");
const emptyHint = document.getElementById("emptyHint");

const packNameEl = document.getElementById("packName");
const namespaceEl = document.getElementById("namespace");
const downloadAsEl = document.getElementById("downloadAs");

const freqPresetEl = document.getElementById("freqPreset");
const defaultBiomeEl = document.getElementById("defaultBiome");
const defaultHeightEl = document.getElementById("defaultHeight");

const applyDefaultsBtn = document.getElementById("applyDefaultsBtn");
const clearBtn = document.getElementById("clearBtn");
const buildBtn = document.getElementById("buildBtn");

let items = []; // { file, id, biome, chance, iterations, rotation, heightMode }

function setStatus(msg, ok = true) {
  statusEl.innerHTML = `<span class="${ok ? "ok" : "danger"}">${msg}</span>`;
}

function safeIdFromFilename(name) {
  return name
    .replace(/\.mcstructure$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "structure";
}

function uuidv4() {
  return crypto.randomUUID();
}

function getPreset() {
  // scatter_chance: 1 means "super common" (debug), bigger = rarer
  switch (freqPresetEl.value) {
    case "insane":   return { chance: 1, iterations: 10 };
    case "common":   return { chance: 4, iterations: 2 };
    case "uncommon": return { chance: 16, iterations: 1 };
    case "rare":     return { chance: 40, iterations: 1 };
    default:         return { chance: 16, iterations: 1 };
  }
}

function biomeOptions(selected) {
  const opts = [
    ["overworld", "Overworld (any)"],
    ["plains", "Plains"],
    ["desert", "Desert"],
    ["forest", "Forest"],
    ["taiga", "Taiga"],
    ["snowy_plains", "Snowy Plains"],
  ];
  return opts.map(([v, label]) =>
    `<option value="${v}" ${selected === v ? "selected" : ""}>${label}</option>`
  ).join("");
}

function biomeFilter(mode) {
  switch (mode) {
    case "plains":
      return [{ test: "is_biome", operator: "==", value: "minecraft:plains" }];
    case "desert":
      return [{ test: "is_biome", operator: "==", value: "minecraft:desert" }];
    case "forest":
      return [{ test: "is_biome", operator: "==", value: "minecraft:forest" }];
    case "taiga":
      return [{ test: "is_biome", operator: "==", value: "minecraft:taiga" }];
    case "snowy_plains":
      return [{ test: "is_biome", operator: "==", value: "minecraft:snowy_plains" }];
    default:
      // Most compatible: "overworld" tag
      return [{ test: "has_biome_tag", operator: "==", value: "overworld" }];
  }
}

function yValue(heightMode) {
  if (heightMode === "fixed80") return 80;
  if (heightMode === "fixed64") return 64;
  // surface height:
  return "query.heightmap(variable.worldx, variable.worldz)";
}

function render() {
  structuresList.innerHTML = "";

  if (items.length === 0) {
    emptyHint.style.display = "inline-block";
    return;
  }
  emptyHint.style.display = "none";

  for (const it of items) {
    const d = document.createElement("details");
    d.open = true;

    d.innerHTML = `
      <summary>${it.file.name} <span class="pill" style="margin-left:10px;">id: ${it.id}</span></summary>

      <div class="row" style="margin-top:10px;">
        <div class="col-6">
          <label>Identifier (becomes structures/&lt;id&gt;.mcstructure)</label>
          <input data-k="id" value="${it.id}" />
        </div>

        <div class="col-6">
          <label>Biome</label>
          <select data-k="biome">
            ${biomeOptions(it.biome)}
          </select>
        </div>

        <div class="col-4">
          <label>Frequency: 1 in N (scatter chance)</label>
          <input data-k="chance" type="number" min="1" value="${it.chance}" />
        </div>

        <div class="col-4">
          <label>Attempts per chunk (iterations)</label>
          <input data-k="iterations" type="number" min="1" max="10" value="${it.iterations}" />
        </div>

        <div class="col-4">
          <label>Rotation</label>
          <select data-k="rotation">
            <option value="random" ${it.rotation === "random" ? "selected" : ""}>Random</option>
            <option value="north" ${it.rotation === "north" ? "selected" : ""}>North</option>
            <option value="east" ${it.rotation === "east" ? "selected" : ""}>East</option>
            <option value="south" ${it.rotation === "south" ? "selected" : ""}>South</option>
            <option value="west" ${it.rotation === "west" ? "selected" : ""}>West</option>
          </select>
        </div>

        <div class="col-6">
          <label>Height placement</label>
          <select data-k="heightMode">
            <option value="surface" ${it.heightMode === "surface" ? "selected" : ""}>Surface (heightmap)</option>
            <option value="fixed64" ${it.heightMode === "fixed64" ? "selected" : ""}>Fixed Y=64</option>
            <option value="fixed80" ${it.heightMode === "fixed80" ? "selected" : ""}>Fixed Y=80</option>
          </select>
        </div>

        <div class="col-6">
          <label>Remove</label>
          <button data-action="remove">Remove this structure</button>
        </div>
      </div>
    `;

    d.querySelectorAll("input,select").forEach((el) => {
      const k = el.dataset.k;
      if (!k) return;

      el.addEventListener("input", () => {
        if (k === "chance") it.chance = Math.max(1, parseInt(el.value || "1", 10));
        else if (k === "iterations") it.iterations = Math.min(10, Math.max(1, parseInt(el.value || "1", 10)));
        else if (k === "id") it.id = safeIdFromFilename(el.value);
        else it[k] = el.value;

        d.querySelector("summary .pill").textContent = `id: ${it.id}`;
      });
    });

    d.querySelector('[data-action="remove"]').addEventListener("click", () => {
      items = items.filter(x => x !== it);
      render();
      setStatus(`Removed ${it.file.name}.`);
    });

    structuresList.appendChild(d);
  }
}

/* ---- Pack generation ---- */

function makeManifest(packName) {
  return {
    format_version: 2,
    header: {
      name: packName,
      description: "Generated with Structure Worldgen Pack Builder",
      uuid: uuidv4(),
      version: [1, 0, 0],
      // You can lower this if needed, but 1.20+ is usually safe for modern Bedrock.
      min_engine_version: [1, 20, 0]
    },
    modules: [
      { type: "data", uuid: uuidv4(), version: [1, 0, 0] }
    ]
  };
}

function makeStructureFeature(ns, id, rotation) {
  // IMPORTANT: structure_template_feature is the correct feature to place .mcstructure files.
  // structure_name should match the name of the mcstructure you place in /structures (without extension).
  return {
    format_version: "1.13.0",
    "minecraft:structure_template_feature": {
      description: { identifier: `${ns}:${id}_feature` },
      structure_name: id,
      adjustment_radius: 8,
      facing_direction: rotation === "random" ? "random" : rotation
    }
  };
}

function makeFeatureRule(ns, id, biomeMode, chance, iterations, heightMode) {
  return {
    format_version: "1.13.0",
    "minecraft:feature_rules": {
      description: {
        identifier: `${ns}:${id}_rule`,
        places_feature: `${ns}:${id}_feature`
      },
      conditions: {
        placement_pass: "surface_pass",
        "minecraft:biome_filter": biomeFilter(biomeMode)
      },
      distribution: {
        iterations,
        scatter_chance: chance,
        x: 0,
        z: 0,
        y: yValue(heightMode)
      }
    }
  };
}

/* ---- File adding ---- */

function addFiles(fileList) {
  const preset = getPreset();
  const biome = defaultBiomeEl.value;
  const heightMode = defaultHeightEl.value;

  let added = 0;
  for (const f of fileList) {
    if (!f.name.toLowerCase().endsWith(".mcstructure")) continue;
    items.push({
      file: f,
      id: safeIdFromFilename(f.name),
      biome,
      chance: preset.chance,
      iterations: preset.iterations,
      rotation: "random",
      heightMode
    });
    added++;
  }

  render();
  setStatus(added ? `Added ${added} structure(s).` : `No .mcstructure files detected.`, !!added);
}

/* ---- UI events ---- */

drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("drag");
});
drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("drag");
  addFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => addFiles(fileInput.files));

applyDefaultsBtn.addEventListener("click", () => {
  const preset = getPreset();
  for (const it of items) {
    it.biome = defaultBiomeEl.value;
    it.heightMode = defaultHeightEl.value;
    it.chance = preset.chance;
    it.iterations = preset.iterations;
  }
  render();
  setStatus("Applied defaults to all structures.");
});

clearBtn.addEventListener("click", () => {
  items = [];
  render();
  setStatus("Cleared structure list.");
});

buildBtn.addEventListener("click", async () => {
  try {
    if (items.length === 0) {
      setStatus("Add at least one .mcstructure first!", false);
      return;
    }

    const packName = (packNameEl.value.trim() || "My Structure Worldgen Pack");
    const ns = (namespaceEl.value.trim() || "custom")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");

    const zip = new JSZip();

    // Correct root files/folders:
    zip.file("manifest.json", JSON.stringify(makeManifest(packName), null, 2));
    const structuresFolder = zip.folder("structures");
    const featuresFolder = zip.folder("features");
    const rulesFolder = zip.folder("feature_rules");

    for (const it of items) {
      const id = safeIdFromFilename(it.id);

      // Place the structure as structures/<id>.mcstructure
      const buf = await it.file.arrayBuffer();
      structuresFolder.file(`${id}.mcstructure`, buf);

      // Create matching feature + rule
      featuresFolder.file(`${id}_feature.json`, JSON.stringify(makeStructureFeature(ns, id, it.rotation), null, 2));
      rulesFolder.file(`${id}_rule.json`, JSON.stringify(
        makeFeatureRule(ns, id, it.biome, it.chance, it.iterations, it.heightMode),
        null, 2
      ));
    }

    const blob = await zip.generateAsync({ type: "blob" });

    const ext = downloadAsEl.value === "zip" ? "zip" : "mcpack";
    const fname = `${packName.replace(/[^a-z0-9_-]+/gi, "_")}.${ext}`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

    setStatus(`Downloaded ${fname}. Now import + test in a NEW world/new chunks.`);
  } catch (err) {
    console.error(err);
    setStatus(`Build failed: ${err?.message || err}`, false);
  }
});

/* init */
render();
setStatus("Ready. Drop .mcstructure files to begin.");
