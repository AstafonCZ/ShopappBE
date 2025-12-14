const express = require("express");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   MongoDB connection
========================= */

const MONGODB_URI =
  "mongodb+srv://novotnytom87_db_user:VRRFyMhv0obANgcd@cluster0.xto6k66.mongodb.net/shopapp?retryWrites=true&w=majority&appName=Cluster0";

async function connectDb() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB (Atlas)");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

connectDb();

/* =========================
   Middleware
========================= */

app.use(express.json());

/*
  Simple authentication via headers
*/
app.use((req, res, next) => {
  const userId = req.header("X-User-Id") || null;
  const profilesHeader = req.header("X-User-Profiles") || "";

  req.user = {
    id: userId,
    profiles: profilesHeader
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
    isAuthenticated: !!userId
  };

  next();
});

function requireProfile(allowedProfiles) {
  return (req, res, next) => {
    if (!req.user.isAuthenticated) {
      return res.status(401).json({
        errorMap: { auth: "User is not authenticated" }
      });
    }

    const hasProfile = req.user.profiles.some((p) =>
      allowedProfiles.includes(p)
    );

    if (!hasProfile) {
      return res.status(403).json({
        errorMap: { auth: "User does not have required profile" }
      });
    }

    next();
  };
}

/* =========================
   Validation helper
========================= */

function validateDtoIn(schema, dtoIn) {
  const errors = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = dtoIn[field];

    if (rules.required && (value === undefined || value === null)) {
      errors[field] = "Field is required";
      continue;
    }

    if (value !== undefined && value !== null) {
      if (rules.type && typeof value !== rules.type) {
        errors[field] = `Field must be of type ${rules.type}`;
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors[field] = `Field must be one of: ${rules.enum.join(", ")}`;
      }
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/* =========================
   MongoDB schema
========================= */

const ShoppingListSchema = new mongoose.Schema({
  ownerId: String,
  name: String,
  description: String,
  members: [
    {
      userId: String,
      role: String
    }
  ],
  items: Array,
  createdAt: Date
});

const ShoppingList = mongoose.model("ShoppingList", ShoppingListSchema);

/* =========================
   Endpoints
========================= */

/* shoppingList/create */
app.post(
  "/shoppingList/create",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const schema = {
      name: { required: true, type: "string" },
      description: { required: false, type: "string" }
    };

    const validationErrors = validateDtoIn(schema, req.body);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors }
      });
    }

    const shoppingList = await ShoppingList.create({
      ownerId: req.user.id,
      name: req.body.name,
      description: req.body.description ?? null,
      members: [{ userId: req.user.id, role: "owner" }],
      items: [],
      createdAt: new Date()
    });

    res.json({
      errorMap: {},
      shoppingList: {
        id: shoppingList._id.toString(),
        ownerId: shoppingList.ownerId,
        name: shoppingList.name,
        description: shoppingList.description,
        members: shoppingList.members,
        items: shoppingList.items,
        createdAt: shoppingList.createdAt
      }
    });
  }
);

/* shoppingList/get */
app.post(
  "/shoppingList/get",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const schema = {
      id: { required: true, type: "string" }
    };

    const validationErrors = validateDtoIn(schema, req.body);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors }
      });
    }

    const shoppingList = await ShoppingList.findById(req.body.id);
    if (!shoppingList) {
      return res.status(404).json({
        errorMap: { notFound: "Shopping list not found" }
      });
    }

    res.json({
      errorMap: {},
      shoppingList: {
        id: shoppingList._id.toString(),
        ownerId: shoppingList.ownerId,
        name: shoppingList.name,
        description: shoppingList.description,
        members: shoppingList.members,
        items: shoppingList.items,
        createdAt: shoppingList.createdAt
      }
    });
  }
);

/* shoppingList/list */
app.post(
  "/shoppingList/list",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const lists = await ShoppingList.find({ ownerId: req.user.id });

    res.json({
      errorMap: {},
      itemList: lists.map((l) => ({
        id: l._id.toString(),
        ownerId: l.ownerId,
        name: l.name,
        description: l.description,
        members: l.members,
        items: l.items,
        createdAt: l.createdAt
      }))
    });
  }
);

/* shoppingList/update */
app.post(
  "/shoppingList/update",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const schema = {
      id: { required: true, type: "string" },
      name: { required: false, type: "string" },
      description: { required: false, type: "string" }
    };

    const validationErrors = validateDtoIn(schema, req.body);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors }
      });
    }

    const shoppingList = await ShoppingList.findById(req.body.id);
    if (!shoppingList) {
      return res.status(404).json({
        errorMap: { notFound: "Shopping list not found" }
      });
    }

    if (req.body.name !== undefined) shoppingList.name = req.body.name;
    if (req.body.description !== undefined)
      shoppingList.description = req.body.description;

    await shoppingList.save();

    res.json({
      errorMap: {},
      shoppingList: {
        id: shoppingList._id.toString(),
        ownerId: shoppingList.ownerId,
        name: shoppingList.name,
        description: shoppingList.description,
        members: shoppingList.members,
        items: shoppingList.items,
        createdAt: shoppingList.createdAt
      }
    });
  }
);

/* shoppingList/delete */
app.post(
  "/shoppingList/delete",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const schema = {
      id: { required: true, type: "string" }
    };

    const validationErrors = validateDtoIn(schema, req.body);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors }
      });
    }

    await ShoppingList.findByIdAndDelete(req.body.id);

    res.json({
      errorMap: {}
    });
  }
);

/* =========================
   Server start
========================= */

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Shopapp backend listening on port ${PORT}`);
  });
}

module.exports = app;
