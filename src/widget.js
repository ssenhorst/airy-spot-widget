import * as d3 from "d3";

const NM_TO_M = 1e-9;
const MM_TO_M = 1e-3;
const UM_TO_M = 1e-6;
const M_TO_UM = 1e6;
const DEFAULT_SIZE = 320;
const GRID_SIZE = 220;
const BASE_FIELD_RANGE_UM = 120;

const presets = [
  { label: "Visible", wavelength_nm: 550, aperture_mm: 25, distance_m: 1.5, field_zoom: 1.0 },
  { label: "IR", wavelength_nm: 1064, aperture_mm: 12, distance_m: 3.0, field_zoom: 1.2 },
  { label: "Large Aperture", wavelength_nm: 532, aperture_mm: 100, distance_m: 2.0, field_zoom: 1.5 },
  { label: "Near Field", wavelength_nm: 650, aperture_mm: 2.0, distance_m: 0.2, field_zoom: 0.8 },
];

function airyAmplitudeFromU(u) {
  if (Math.abs(u) < 1e-8) {
    return 1;
  }
  const j1 = besselJ1(u);
  return (2 * j1) / u;
}

function besselJ1(x) {
  const ax = Math.abs(x);
  if (ax < 8.0) {
    const y = x * x;
    const ans1 =
      x *
      (72362614232.0 +
        y *
          (-7895059235.0 +
            y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const ans2 =
      144725228442.0 +
      y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return ans1 / ans2;
  }

  const z = 8.0 / ax;
  const y = z * z;
  const xx = ax - 2.356194491;
  const ans1 = 1.0 + y * (0.00183105 + y * (-0.00003516396496 + y * (0.000002457520174 + y * -0.000000240337019)));
  const ans2 =
    0.04687499995 +
    y * (-0.0002002690873 + y * (0.000008449199096 + y * (-0.00000088228987 + y * 0.000000105787412)));
  const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * ans1 - z * Math.sin(xx) * ans2);
  return x < 0 ? -ans : ans;
}

function formatNumber(v, digits = 3) {
  return Number(v).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function makeScaleControl(parent, config, state, onInput) {
  const wrap = parent.append("div").attr("class", "airy-slider");
  const label = wrap.append("label");
  label.append("span").text(config.label);
  const valueText = label.append("span");

  const slider = wrap
    .append("input")
    .attr("type", "range")
    .attr("min", config.min)
    .attr("max", config.max)
    .attr("step", config.step)
    .property("value", state[config.key]);

  const updateLabel = () => {
    valueText.text(config.format(state[config.key]));
  };

  slider.on("input", (event) => {
    state[config.key] = Number(event.target.value);
    updateLabel();
    onInput();
  });

  updateLabel();

  return {
    setValue(value) {
      state[config.key] = Number(value);
      slider.property("value", state[config.key]);
      updateLabel();
    },
  };
}

function computeAiryData(state) {
  const lambda = state.wavelength_nm * NM_TO_M;
  const diameter = state.aperture_mm * MM_TO_M;
  const distance = state.distance_m;
  const theta = 1.22 * lambda / diameter;
  const r1 = theta * distance;

  const rangeM = BASE_FIELD_RANGE_UM * UM_TO_M * state.field_zoom;
  const x = d3.scaleLinear().domain([-rangeM, rangeM]).range([0, GRID_SIZE - 1]);

  const pixels = new Array(GRID_SIZE * GRID_SIZE);
  for (let iy = 0; iy < GRID_SIZE; iy += 1) {
    for (let ix = 0; ix < GRID_SIZE; ix += 1) {
      const sx = x.invert(ix);
      const sy = x.invert(iy);
      const r = Math.hypot(sx, sy);
      const u = (Math.PI * diameter * r) / (lambda * distance);
      pixels[iy * GRID_SIZE + ix] = airyAmplitudeFromU(u);
    }
  }

  const radialRangeM = rangeM;
  const radialSamples = d3.range(0, 400).map((i) => {
    const r = (i / 399) * radialRangeM;
    const u = (Math.PI * diameter * r) / (lambda * distance);
    return { r_um: r * M_TO_UM, amplitude: airyAmplitudeFromU(u) };
  });

  return {
    pixels,
    radialSamples,
    theta,
    ringRadiusUm: r1 * M_TO_UM,
    firstZeroUm: r1 * M_TO_UM,
    xRangeUm: rangeM * M_TO_UM,
  };
}

function drawHeatmap(svg, data, size) {
  svg.selectAll("*").remove();

  const margin = { top: 24, right: 16, bottom: 44, left: 52 };
  const w = size;
  const h = size;
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  const g = svg
    .attr("viewBox", `0 0 ${w} ${h}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([-data.xRangeUm, data.xRangeUm]).range([0, innerW]);
  const y = d3.scaleLinear().domain([-data.xRangeUm, data.xRangeUm]).range([innerH, 0]);

  const color = d3
    .scaleSequential()
    .domain([-1.0, 1.0])
    .interpolator(d3.interpolateRdBu);

  const image = new ImageData(GRID_SIZE, GRID_SIZE);
  for (let i = 0; i < data.pixels.length; i += 1) {
    const c = d3.color(color(data.pixels[i]));
    const idx = i * 4;
    image.data[idx] = c.r;
    image.data[idx + 1] = c.g;
    image.data[idx + 2] = c.b;
    image.data[idx + 3] = 255;
  }

  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.putImageData(image, 0, 0);

  g.append("image")
    .attr("href", canvas.toDataURL())
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("preserveAspectRatio", "none");

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(6));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));

  svg
    .append("text")
    .attr("x", w / 2)
    .attr("y", h - 6)
    .attr("text-anchor", "middle")
    .attr("fill", "currentColor")
    .attr("font-size", 12)
    .text("x (um)");

  svg
    .append("text")
    .attr("x", -h / 2)
    .attr("y", 14)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "currentColor")
    .attr("font-size", 12)
    .text("y (um)");
}

function drawRadialSlice(svg, data, size) {
  svg.selectAll("*").remove();

  const margin = { top: 24, right: 16, bottom: 44, left: 52 };
  const w = size;
  const h = size;
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  const g = svg
    .attr("viewBox", `0 0 ${w} ${h}`)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, data.xRangeUm]).range([0, innerW]);
  const y = d3.scaleLinear().domain([-.2, 1.02]).range([innerH, 0]);

  const area = d3
    .area()
    .x((d) => x(d.r_um))
    .y0(y(0))
    .y1((d) => y(d.amplitude));

  const line = d3
    .line()
    .x((d) => x(d.r_um))
    .y((d) => y(d.amplitude));

  // g.append("path").datum(data.radialSamples).attr("d", area).attr("fill", "var(--slice-fill)");
  g.append("path").datum(data.radialSamples).attr("class", "slice-line").attr("d", line);

  const zeroX = x(data.firstZeroUm);
  g.append("line").attr("class", "zero-marker").attr("x1", zeroX).attr("x2", zeroX).attr("y1", 0).attr("y2", innerH);
  g.append("text").attr("class", "zero-text").attr("x", zeroX + 6).attr("y", 16).text("1st zero");

  g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(6));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5));

  svg
    .append("text")
    .attr("x", w / 2)
    .attr("y", h - 6)
    .attr("text-anchor", "middle")
    .attr("fill", "currentColor")
    .attr("font-size", 12)
    .text("radius r (um)");

  svg
    .append("text")
    .attr("x", -h / 2)
    .attr("y", 14)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("fill", "currentColor")
    .attr("font-size", 12)
    .text("A");
}

function makeStandaloneMount(el, state, setState, readOnly = false) {
  const root = d3.select(el).append("div").attr("class", "airy-root");

  const leftPanel = root.append("div").attr("class", "airy-panel airy-plot");
  leftPanel.append("h3").attr("class", "airy-title").text("2D Airy Pattern");
  const heatmapSvg = leftPanel.append("svg");

  const middlePanel = root.append("div").attr("class", "airy-panel airy-plot");
  middlePanel.append("h3").attr("class", "airy-title").text("Radial Slice");
  const sliceSvg = middlePanel.append("svg");

  const rightWrap = root.append("div").attr("class", "airy-controls-wrap");

  const controlBox = rightWrap.append("div").attr("class", "airy-controls-box");
  controlBox.append("h3").attr("class", "airy-title").text("Controls");

  const presetsWrap = controlBox.append("div").attr("class", "airy-presets");
  const controlsByKey = new Map();

  const syncControlUi = () => {
    controlsByKey.forEach((control, key) => {
      control.setValue(state[key]);
    });
  };

  presets.forEach((preset) => {
    const button = presetsWrap.append("button").text(preset.label);
    if (!readOnly) {
      button.on("click", () => {
        Object.assign(state, {
          wavelength_nm: preset.wavelength_nm,
          aperture_mm: preset.aperture_mm,
          distance_m: preset.distance_m,
          field_zoom: preset.field_zoom,
        });
        syncControlUi();
        setState(state);
        refresh();
      });
    } else {
      button.attr("disabled", true);
    }
  });

  const controls = [
    {
      key: "wavelength_nm",
      label: "Wavelength",
      min: 380,
      max: 1550,
      step: 1,
      format: (v) => `${Math.round(v)} nm`,
    },
    {
      key: "aperture_mm",
      label: "Aperture Diameter",
      min: 0.2,
      max: 250,
      step: 0.1,
      format: (v) => `${formatNumber(v, 1)} mm`,
    },
    {
      key: "distance_m",
      label: "Screen Distance",
      min: 0.05,
      max: 20,
      step: 0.01,
      format: (v) => `${formatNumber(v, 2)} m`,
    },
    {
      key: "field_zoom",
      label: "Field Zoom",
      min: 0.6,
      max: 3.0,
      step: 0.01,
      format: (v) => `${formatNumber(v, 2)}x`,
    },
  ];

  const measureBox = rightWrap.append("div").attr("class", "airy-measure-box");
  measureBox.append("h3").attr("class", "airy-title").text("Measured Values");

  const measureGrid = measureBox.append("div").attr("class", "airy-measure-grid");

  const thetaItem = measureGrid.append("div").attr("class", "airy-measure-item");
  const thetaLabel = thetaItem.append("div").attr("class", "airy-measure-label").text("Rayleigh angle (urad)");
  const thetaValue = thetaItem.append("div").attr("class", "airy-measure-value");

  const radiusItem = measureGrid.append("div").attr("class", "airy-measure-item");
  radiusItem.append("div").attr("class", "airy-measure-label").text("1st ring radius on screen");
  const radiusValue = radiusItem.append("div").attr("class", "airy-measure-value");

  function refresh() {
    const data = computeAiryData(state);
    drawHeatmap(heatmapSvg, data, DEFAULT_SIZE);
    drawRadialSlice(sliceSvg, data, DEFAULT_SIZE);
    thetaValue.text(`${formatNumber(data.theta * 1e6, 3)} urad`);
    radiusValue.text(`${formatNumber(data.ringRadiusUm, 2)} um`);
  }

  const triggerRefresh = () => {
    refresh();
  };

  controls.forEach((cfg) => {
    const control = makeScaleControl(controlBox, cfg, state, () => {
      if (!readOnly) {
        setState(state);
        refresh();
      } else {
        triggerRefresh();
      }
    });
    controlsByKey.set(cfg.key, control);
  });

  syncControlUi();
  refresh();

  return {
    refresh,
    syncControlUi,
  };
}

function clampState(input) {
  return {
    wavelength_nm: Math.min(1550, Math.max(380, Number(input.wavelength_nm) || 550)),
    aperture_mm: Math.min(250, Math.max(0.2, Number(input.aperture_mm) || 25)),
    distance_m: Math.min(20, Math.max(0.05, Number(input.distance_m) || 1.5)),
    field_zoom: Math.min(3.0, Math.max(0.6, Number(input.field_zoom) || 1.0)),
  };
}

export function mountAiryWidget(el, initialState = {}) {
  const state = clampState(initialState);
  return makeStandaloneMount(
    el,
    state,
    (next) => {
      Object.assign(state, clampState(next));
    },
    true,
  );
}

export default {
  render({ model, el }) {
    const readState = () =>
      clampState({
        wavelength_nm: model.get("wavelength_nm"),
        aperture_mm: model.get("aperture_mm"),
        distance_m: model.get("distance_m"),
        field_zoom: model.get("field_zoom"),
      });

    const state = readState();
    const mount = makeStandaloneMount(el, state, (next) => {
      const v = clampState(next);
      model.set("wavelength_nm", v.wavelength_nm);
      model.set("aperture_mm", v.aperture_mm);
      model.set("distance_m", v.distance_m);
      model.set("field_zoom", v.field_zoom);
      model.save_changes();
    });

    const onModelChange = () => {
      Object.assign(state, readState());
      mount.syncControlUi();
      mount.refresh();
    };

    model.on("change:wavelength_nm", onModelChange);
    model.on("change:aperture_mm", onModelChange);
    model.on("change:distance_m", onModelChange);
    model.on("change:field_zoom", onModelChange);
  },
};
