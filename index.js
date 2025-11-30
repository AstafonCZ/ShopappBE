const express = require("express");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;


const MONGODB_URI =
  "mongodb+srv://novotnytom87_db_user:VRRFyMhv0obANgcd@cluster0.xto6k66.mongodb.net/?appName=Cluster0";

app.use(express.json());

/* ------------------------ MongoDB připojení ------------------------ */

async function connectDb() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB (Atlas)");
  } catch (e) {
    console.error("MongoDB connection error:", e);
    process.exit(1);
  }
}

/* ------------------------ Schémata ------------------------ */

const MemberSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    role: {
      type: String,
      enum: ["owner", "member", "viewer"],
      required: true
    }
  },
  { _id: false }
);

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: null },
  unit: { type: String, default: null },
  isPurchased: { type: Boolean, default: false }
});

const ShoppingListSchema = new mongoose.Schema({
  ownerId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: null },
  members: { type: [MemberSchema], default: [] },
  items: { type: [ItemSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

const ShoppingList = mongoose.model("ShoppingList", ShoppingListSchema);

/* ------------------------ Pomocné mapování výstupu ------------------------ */

function mapShoppingList(listDoc) {
  if (!listDoc) return null;

  return {
    id: listDoc._id.toString(),
    ownerId: listDoc.ownerId,
    name: listDoc.name,
    description: listDoc.description,
    members: listDoc.members.map((m) => ({
      userId: m.userId,
      role: m.role
    })),
    items: listDoc.items.map((i) => ({
      id: i._id.toString(),
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      isPurchased: i.isPurchased
    })),
    createdAt: listDoc.createdAt.toISOString()
  };
}

/* ------------------------ „Autentizace“ z předchozího úkolu ------------------------ */

app.use((req, res, next) => {
  const userId = req.header("X-User-Id") || null;
  const profilesHeader = req.header("X-User-Profiles") || "";
  const profiles = profilesHeader
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  req.user = {
    id: userId,
    profiles,
    isAuthenticated: !!userId
  };

  next();
});

/* Helper pro autorizaci podle profilů */
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

/* Jednoduchá validace dtoIn proti schématu */
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

/* ------------------------ uuCmd: shoppingList/create ------------------------ */
/*
  dtoIn:
  {
    "name": "string, required",
    "description": "string, optional"
  }
*/
app.post(
  "/shoppingList/create",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const dtoIn = req.body;

    const schema = {
      name: { required: true, type: "string" },
      description: { required: false, type: "string" }
    };

    const validationErrors = validateDtoIn(schema, dtoIn);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors },
        dtoIn
      });
    }

    try {
      const list = await ShoppingList.create({
        ownerId: req.user.id,
        name: dtoIn.name,
        description: dtoIn.description ?? null,
        members: [
          {
            userId: req.user.id,
            role: "owner"
          }
        ]
      });

      res.json({
        errorMap: {},
        shoppingList: mapShoppingList(list)
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        errorMap: { system: "Failed to create shopping list" }
      });
    }
  }
);

/* ------------------------ uuCmd: shoppingList/get ------------------------ */
/*
  dtoIn: { "id": "string, required" }
*/
app.post(
  "/shoppingList/get",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const dtoIn = req.body;

    const schema = {
      id: { required: true, type: "string" }
    };

    const validationErrors = validateDtoIn(schema, dtoIn);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors },
        dtoIn
      });
    }

    try {
      const list = await ShoppingList.findById(dtoIn.id);
      if (!list) {
        return res.status(404).json({
          errorMap: { shoppingListDoesNotExist: "Shopping list not found" }
        });
      }

      const userId = req.user.id;
      const isOwner = list.ownerId === userId;
      const isMember = list.members.some((m) => m.userId === userId);

      if (!isOwner && !isMember) {
        return res.status(403).json({
          errorMap: { notAuthorized: "User is not allowed to read this list" }
        });
      }

      res.json({
        errorMap: {},
        shoppingList: mapShoppingList(list)
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        errorMap: { system: "Failed to get shopping list" }
      });
    }
  }
);

/* ------------------------ uuCmd: shoppingList/list ------------------------ */
/*
  dtoIn (volitelné):
  { "ownedOnly": "boolean, optional" }
*/
app.post(
  "/shoppingList/list",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const dtoIn = req.body || {};

    const schema = {
      ownedOnly: { required: false, type: "boolean" }
    };

    const validationErrors = validateDtoIn(schema, dtoIn);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors },
        dtoIn
      });
    }

    const ownedOnly = dtoIn.ownedOnly ?? false;
    const userId = req.user.id;

    const query = ownedOnly
      ? { ownerId: userId }
      : {
          $or: [{ ownerId: userId }, { "members.userId": userId }]
        };

    try {
      const lists = await ShoppingList.find(query).sort({ createdAt: -1 });
      res.json({
        errorMap: {},
        itemList: lists.map(mapShoppingList)
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        errorMap: { system: "Failed to list shopping lists" }
      });
    }
  }
);

/* ------------------------ uuCmd: shoppingList/update ------------------------ */
/*
  dtoIn:
  {
    "id": "string, required",
    "name": "string, optional",
    "description": "string, optional"
  }
*/
app.post(
  "/shoppingList/update",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const dtoIn = req.body;

    const schema = {
      id: { required: true, type: "string" },
      name: { required: false, type: "string" },
      description: { required: false, type: "string" }
    };

    const validationErrors = validateDtoIn(schema, dtoIn);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors },
        dtoIn
      });
    }

    try {
      const list = await ShoppingList.findById(dtoIn.id);
      if (!list) {
        return res.status(404).json({
          errorMap: { shoppingListDoesNotExist: "Shopping list not found" }
        });
      }

      if (list.ownerId !== req.user.id) {
        return res.status(403).json({
          errorMap: {
            notAuthorized: "Only owner can update the shopping list"
          }
        });
      }

      if (dtoIn.name !== undefined) list.name = dtoIn.name;
      if (dtoIn.description !== undefined)
        list.description = dtoIn.description;

      const saved = await list.save();

      res.json({
        errorMap: {},
        shoppingList: mapShoppingList(saved)
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        errorMap: { system: "Failed to update shopping list" }
      });
    }
  }
);

/* ------------------------ uuCmd: shoppingList/delete ------------------------ */
/*
  dtoIn:
  { "id": "string, required" }
*/
app.post(
  "/shoppingList/delete",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const dtoIn = req.body;

    const schema = {
      id: { required: true, type: "string" }
    };

    const validationErrors = validateDtoIn(schema, dtoIn);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors },
        dtoIn
      });
    }

    try {
      const list = await ShoppingList.findById(dtoIn.id);
      if (!list) {
        return res.status(404).json({
          errorMap: { shoppingListDoesNotExist: "Shopping list not found" }
        });
      }

      if (list.ownerId !== req.user.id) {
        return res.status(403).json({
          errorMap: {
            notAuthorized: "Only owner can delete the shopping list"
          }
        });
      }

      await ShoppingList.deleteOne({ _id: dtoIn.id });

      res.json({
        errorMap: {}
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        errorMap: { system: "Failed to delete shopping list" }
      });
    }
  }
);

/* ------------------------ uuCmd: shoppingList/addMember ------------------------ */
/*
  dtoIn:
  {
    "listId": "string, required",
    "userId": "string, required",
    "role": "string, required, enum: ['member', 'viewer']"
  }
*/
app.post(
  "/shoppingList/addMember",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const dtoIn = req.body;

    const schema = {
      listId: { required: true, type: "string" },
      userId: { required: true, type: "string" },
      role: {
        required: true,
        type: "string",
        enum: ["member", "viewer"]
      }
    };

    const validationErrors = validateDtoIn(schema, dtoIn);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors },
        dtoIn
      });
    }

    try {
      const list = await ShoppingList.findById(dtoIn.listId);
      if (!list) {
        return res.status(404).json({
          errorMap: { shoppingListDoesNotExist: "Shopping list not found" }
        });
      }

      if (list.ownerId !== req.user.id) {
        return res.status(403).json({
          errorMap: {
            notAuthorized: "Only owner can add members"
          }
        });
      }

      const exists = list.members.some((m) => m.userId === dtoIn.userId);
      if (!exists) {
        list.members.push({
          userId: dtoIn.userId,
          role: dtoIn.role
        });
      }

      const saved = await list.save();

      res.json({
        errorMap: {},
        shoppingList: mapShoppingList(saved)
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        errorMap: { system: "Failed to add member" }
      });
    }
  }
);

/* ------------------------ uuCmd: shoppingItem/add ------------------------ */
/*
  dtoIn:
  {
    "listId": "string, required",
    "name": "string, required",
    "quantity": "number, optional",
    "unit": "string, optional"
  }
*/
app.post(
  "/shoppingItem/add",
  requireProfile(["Operatives", "Authorities"]),
  async (req, res) => {
    const dtoIn = req.body;

    const schema = {
      listId: { required: true, type: "string" },
      name: { required: true, type: "string" },
      quantity: { required: false, type: "number" },
      unit: { required: false, type: "string" }
    };

    const validationErrors = validateDtoIn(schema, dtoIn);
    if (validationErrors) {
      return res.status(400).json({
        errorMap: { validation: validationErrors },
        dtoIn
      });
    }

    try {
      const list = await ShoppingList.findById(dtoIn.listId);
      if (!list) {
        return res.status(404).json({
          errorMap: { shoppingListDoesNotExist: "Shopping list not found" }
        });
      }

      const userId = req.user.id;
      const isOwner = list.ownerId === userId;
      const isMember = list.members.some((m) => m.userId === userId);
      if (!isOwner && !isMember) {
        return res.status(403).json({
          errorMap: { notAuthorized: "User is not allowed to add items" }
        });
      }

      list.items.push({
        name: dtoIn.name,
        quantity: dtoIn.quantity ?? null,
        unit: dtoIn.unit ?? null
      });

      const saved = await list.save();
      const newItem = saved.items[saved.items.length - 1];

      res.json({
        errorMap: {},
        item: {
          id: newItem._id.toString(),
          name: newItem.name,
          quantity: newItem.quantity,
          unit: newItem.unit,
          isPurchased: newItem.isPurchased
        }
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({
        errorMap: { system: "Failed to add item" }
      });
    }
  }
);

/* ------------------------ Start serveru ------------------------ */

connectDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Shopapp backend listening on port ${PORT}`);
  });
});
