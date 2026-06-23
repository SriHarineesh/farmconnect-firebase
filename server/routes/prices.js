// routes/prices.js
// In production, replace the mock data with a real mandi price API
// e.g. data.gov.in Agmarknet: https://data.gov.in/catalog/current-daily-price-various-commodities
const express = require("express");
const router  = express.Router();

const BASE_PRICES = [
  { crop:"Wheat",        unit:"Quintal", price:2180 },
  { crop:"Rice (Paddy)", unit:"Quintal", price:2040 },
  { crop:"Maize",        unit:"Quintal", price:1950 },
  { crop:"Soybean",      unit:"Quintal", price:4320 },
  { crop:"Cotton",       unit:"Quintal", price:6800 },
  { crop:"Groundnut",    unit:"Quintal", price:5780 },
  { crop:"Bajra",        unit:"Quintal", price:2350 },
  { crop:"Jowar",        unit:"Quintal", price:2970 },
  { crop:"Onion",        unit:"Quintal", price:1400 },
  { crop:"Tomato",       unit:"Quintal", price:1120 },
  { crop:"Potato",       unit:"Quintal", price:1210 },
  { crop:"Turmeric",     unit:"Quintal", price:16200 },
];

router.get("/", (_req, res) => {
  const prices = BASE_PRICES.map((r) => {
    const drift  = Math.random() * 4 - 2; // ±2 %
    const price  = Math.round(r.price * (1 + drift / 100));
    const change = Number((((price - r.price) / r.price) * 100).toFixed(1));
    return { ...r, price, change, updatedAt: new Date().toISOString() };
  });
  res.json({ success: true, source: "mock — swap for data.gov.in API", prices });
});

module.exports = router;
