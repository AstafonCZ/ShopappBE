const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");

let createdListId;

describe("shoppingList/delete", () => {

  beforeAll(async () => {
    const res = await request(app)
      .post("/shoppingList/create")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({ name: "List to delete" });

    createdListId = res.body.shoppingList.id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("happy day – delete shopping list", async () => {
    const res = await request(app)
      .post("/shoppingList/delete")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({ id: createdListId });

    expect(res.statusCode).toBe(200);
    expect(res.body.errorMap).toBeDefined();
  });

  test("alternative – delete non-existing list", async () => {
    const res = await request(app)
      .post("/shoppingList/delete")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({ id: "000000000000000000000000" });

    expect(res.statusCode).toBe(200);
  });

});
