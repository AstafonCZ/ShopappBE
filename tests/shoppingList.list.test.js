const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");

describe("shoppingList/list", () => {

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("happy day – returns list of shopping lists", async () => {
    const res = await request(app)
      .post("/shoppingList/list")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({});

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.itemList)).toBe(true);
  });

  test("alternative – user not authenticated", async () => {
    const res = await request(app)
      .post("/shoppingList/list")
      .send({});

    expect(res.statusCode).toBe(401);
    expect(res.body.errorMap).toBeDefined();
  });

});
