const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/*
  Jednoduchá "autentizace":
  Očekává headery:
    X-User-Id: ID přihlášeného uživatele
    X-User-Profiles: seznam profilů oddělených čárkou, např. "Operatives" nebo "Operatives,Authorities"
*/
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

/*
  Helper pro autorizaci podle profilů.
  allowedProfiles = např. ["Operatives", "Authorities"]
*/
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

/*
  Jednoduchá validace dtoIn proti schématu.
  Schéma má tvar:
  {
    fieldName: { required: bool, type: "string" | "number" | "boolean", enum: [ ... ] }
  }
*/
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

/*
  uuCmd: shoppingList/create
  Profily: Operatives, Authorities
  dtoIn odpovídá dokumentu:
  {
    "name": "string, required",
    "description": "string, optional"
    // members tady pro jednoduchost nevalidujeme
  }
*/
app.post(
  "/shoppingList/create",
  requireProfile(["Operatives", "Authorities"]),
  (req, res) => {
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

    // Aplikacni logiku zatím neřešíme, jen vrátíme "fake" objekt
    const shoppingList = {
      id: "list-" + Date.now(),
      ownerId: req.user.id,
      name: dtoIn.name,
      description: dtoIn.description ?? null,
      members: [
        {
          userId: req.user.id,
          role: "owner"
        }
      ],
      createdAt: new Date().toISOString()
    };

    res.json({
      errorMap: {},
      shoppingList
    });
  }
);

/*
  uuCmd: shoppingList/get
  Profily: Operatives, Authorities
  dtoIn:
  {
    "id": "string, required"
  }
*/
app.post(
  "/shoppingList/get",
  requireProfile(["Operatives", "Authorities"]),
  (req, res) => {
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

    // Mockovaný výstup
    const shoppingList = {
      id: dtoIn.id,
      ownerId: req.user.id,
      name: "Mock list name",
      description: "Mock description",
      members: [
        {
          userId: req.user.id,
          role: "owner"
        }
      ],
      items: []
    };

    res.json({
      errorMap: {},
      shoppingList
    });
  }
);

/*
  uuCmd: shoppingList/addMember
  Profily: Operatives, Authorities
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
  (req, res) => {
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

    const shoppingList = {
      id: dtoIn.listId,
      members: [
        { userId: "owner-" + req.user.id, role: "owner" },
        { userId: dtoIn.userId, role: dtoIn.role }
      ]
    };

    res.json({
      errorMap: {},
      shoppingList
    });
  }
);

/*
  uuCmd: shoppingItem/add
  Profily: Operatives, Authorities
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
  (req, res) => {
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

    const item = {
      id: "item-" + Date.now(),
      listId: dtoIn.listId,
      name: dtoIn.name,
      quantity: dtoIn.quantity ?? null,
      unit: dtoIn.unit ?? null,
      isPurchased: false
    };

    res.json({
      errorMap: {},
      item
    });
  }
);

// Start serveru
app.listen(PORT, () => {
  console.log(`Shopapp backend listening on port ${PORT}`);
});
