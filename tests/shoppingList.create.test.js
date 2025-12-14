const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");

describe("shoppingList/create", () => {

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("happy day – creates shopping list", async () => {
    const res = await request(app)
      .post("/shoppingList/create")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({
        name: "Test list",
        description: "Test description"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.shoppingList).toBeDefined();
    expect(res.body.shoppingList.name).toBe("Test list");
  });

  test("alternative – missing name", async () => {
    const res = await request(app)
      .post("/shoppingList/create")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.errorMap).toBeDefined();
  });

});
