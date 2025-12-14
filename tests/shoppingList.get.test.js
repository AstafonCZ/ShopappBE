const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");

let createdListId;

describe("shoppingList/get", () => {

  beforeAll(async () => {
    const res = await request(app)
      .post("/shoppingList/create")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({ name: "List for get test" });

    createdListId = res.body.shoppingList.id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("happy day – get existing shopping list", async () => {
    const res = await request(app)
      .post("/shoppingList/get")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({ id: createdListId });

    expect(res.statusCode).toBe(200);
    expect(res.body.shoppingList).toBeDefined();
    expect(res.body.shoppingList.id).toBe(createdListId);
  });

  test("alternative – list does not exist", async () => {
    const res = await request(app)
      .post("/shoppingList/get")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({ id: "000000000000000000000000" });

    expect(res.statusCode).toBe(404);
    expect(res.body.errorMap).toBeDefined();
  });

});
