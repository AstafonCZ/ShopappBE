const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index");

let createdListId;

describe("shoppingList/update", () => {

  beforeAll(async () => {
    const res = await request(app)
      .post("/shoppingList/create")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({ name: "List to update" });

    createdListId = res.body.shoppingList.id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test("happy day – update shopping list", async () => {
    const res = await request(app)
      .post("/shoppingList/update")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({
        id: createdListId,
        name: "Updated name"
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.shoppingList.name).toBe("Updated name");
  });

  test("alternative – list does not exist", async () => {
    const res = await request(app)
      .post("/shoppingList/update")
      .set("X-User-Id", "testUser")
      .set("X-User-Profiles", "Operatives")
      .send({
        id: "000000000000000000000000",
        name: "Does not matter"
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.errorMap).toBeDefined();
  });

});
