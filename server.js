const express = require("express");
const axios = require("axios");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "https://yourfrontend.netlify.app" }));

 

/* ----------------------------------
   ✅ MONGODB CONNECTION
---------------------------------- */
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Atlas Connected Successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
  });

app.post("/save-ride", async (req, res) => {
  try {
    const rideData = req.body;
    // save to MongoDB
    await RideModel.create(rideData);
    res.json({ success: true, message: "Ride saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* ----------------------------------
   ✅ RIDE SCHEMA & MODEL
---------------------------------- */
const rideSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  distance: { type: Number, default: 0 },   // in km
  fuelUsed: { type: Number, default: 0 },   // in litres
  mileage: { type: Number, default: 0 }     // km/l
});

const Ride = mongoose.model("Ride", rideSchema);

/* ----------------------------------
   ✅ RIDE ENDPOINTS
---------------------------------- */

// POST a new ride
app.post("/rides", async (req, res) => {
  try {
    const { date, distance, fuelUsed, mileage } = req.body;

    const ride = new Ride({
      date: date || new Date(),
      distance: distance || 0,
      fuelUsed: fuelUsed || 0,
      mileage: mileage || 0
    });

    await ride.save();
    res.json({ message: "Ride saved successfully", ride });
  } catch (error) {
    console.error("Error saving ride:", error.message);
    res.status(500).json({ message: "Unable to save ride" });
  }
});

// GET all rides (optional filter by date)
app.get("/rides", async (req, res) => {
  try {
    const { from, to } = req.query;
    let filter = {};
    if (from && to) {
      filter.date = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }
    const rides = await Ride.find(filter).sort({ date: -1 });
    res.json(rides);
  } catch (error) {
    console.error("Error fetching rides:", error.message);
    res.status(500).json({ message: "Unable to fetch rides" });
  }
});

/* ----------------------------------
   FUEL NEWS API (UNCHANGED)
---------------------------------- */
app.get("/fuel-news", async (req, res) => {
  try {
    const response = await axios.get(
      "https://gnews.io/api/v4/search",
      {
        params: {
          q: "fuel petrol diesel oil crude",
          lang: "en",
          country: "in",
          max: 10,
          token: process.env.GNEWS_API_KEY
        }
      }
    );

    const fuelKeywords = [
      "fuel",
      "petrol",
      "diesel",
      "fuel price",
      "petrol price",
      "diesel price",
      "oil price",
      "crude oil",
      "fuel hike",
      "fuel cut"
    ];

    const filteredNews = response.data.articles
      .filter(item => {
        const text = `${item.title} ${item.description || ""}`.toLowerCase();
        return fuelKeywords.some(keyword => text.includes(keyword));
      })
      .slice(0, 5)
      .map(item => ({
        title: item.title,
        description: item.description || "No description available",
        source: item.source?.name || "GNews",
        url: item.url
      }));

    res.json(filteredNews);

  } catch (error) {
    console.error("Fuel News API Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to fetch fuel news" });
  }
});



/* ----------------------------------
   FUEL PRICE API (UNCHANGED)
---------------------------------- */
app.get("/fuel-price", async (req, res) => {
  try {
    const districtQuery = req.query.district;
    const SHEET_URL =
      "https://docs.google.com/spreadsheets/d/1WAEvMsj8XvRUs-MR0jLNewUEJcnFRA5ZbvdoXWFJEj0/export?format=csv";
    const response = await axios.get(SHEET_URL);
    const rows = response.data.split("\n").slice(1);

    const data = rows.map(row => {
      const [district, petrol, diesel] = row.replace(/"/g, "").split(",");
      return {
        district: district?.trim(),
        petrol: Number(petrol),
        diesel: Number(diesel)
      };
    });

    if (districtQuery) {
      const result = data.find(d => d.district?.toLowerCase() === districtQuery.toLowerCase());
      if (!result) return res.status(404).json({ message: "District not found" });
      return res.json(result);
    }

    res.json(data);

  } catch (error) {
    console.error("Fuel Price Sheet Error:", error.message);
    res.status(500).json({ message: "Unable to fetch fuel price data" });
  }
});

/* ----------------------------------
   NEARBY PETROL BUNKS (UNCHANGED)
---------------------------------- */
app.get("/nearby-bunks", async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: "Latitude & Longitude required" });

    const overpassQuery = `
      [out:json];
      (
        node["amenity"="fuel"](around:5000,${lat},${lng});
        way["amenity"="fuel"](around:5000,${lat},${lng});
        relation["amenity"="fuel"](around:5000,${lat},${lng});
      );
      out center;
    `;

    const response = await axios.post(
      "https://overpass-api.de/api/interpreter",
      overpassQuery,
      { headers: { "Content-Type": "text/plain" } }
    );

    const bunks = response.data.elements
      .map(b => ({
        name: b.tags?.name || "Petrol Bunk",
        lat: b.lat || b.center?.lat,
        lng: b.lon || b.center?.lon
      }))
      .filter(b => b.lat && b.lng);

    res.json(bunks);

  } catch (error) {
    console.error("Nearby Bunks Error:", error.message);
    res.status(500).json({ message: "Unable to fetch nearby petrol bunks" });
  }
});

/* ----------------------------------
   SERVER START
---------------------------------- */
app.listen(PORT, () => {
  console.log(`🔥 FuelRadar backend running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.type("text").send("FuelRadar backend running 🚀");
});

