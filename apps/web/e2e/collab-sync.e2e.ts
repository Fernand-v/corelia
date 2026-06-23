import { test, expect } from "@playwright/test";
import jwt from "jsonwebtoken";
import { TEST_COLLAB_SECRET, fixtureUrl, wsUrl } from "./config";

declare global {
  interface Window {
    collabConnect: (url: string, name: string, token: string) => Promise<boolean>;
    collabInsert: (value: string) => void;
    collabGet: () => string;
  }
}

// El servidor Hocuspocus valida un JWT con scope collab:document cuyo yDocName
// debe coincidir con el nombre del documento (la sala).
const mintToken = (userId: string, room: string) =>
  jwt.sign(
    { sub: userId, docId: room, yDocName: room, scope: "collab:document" },
    TEST_COLLAB_SECRET
  );

const connectArgs = ([u, n, t]: [string, string, string]) => window.collabConnect(u, n, t);

test.describe("Colaboración Y.js vía Hocuspocus", () => {
  test("dos clientes sincronizan ediciones bidireccionalmente", async ({ browser }) => {
    const room = `doc-${Date.now()}`;
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(fixtureUrl());
    await pageB.goto(fixtureUrl());

    await pageA.evaluate(connectArgs, [wsUrl(), room, mintToken("user-a", room)]);
    await pageB.evaluate(connectArgs, [wsUrl(), room, mintToken("user-b", room)]);

    // A escribe → B lo recibe.
    await pageA.evaluate(() => window.collabInsert("hola "));
    await expect.poll(() => pageB.evaluate(() => window.collabGet())).toBe("hola ");

    // B escribe → A lo recibe (mismo CRDT, sin pisar lo anterior).
    await pageB.evaluate(() => window.collabInsert("mundo"));
    await expect.poll(() => pageA.evaluate(() => window.collabGet())).toBe("hola mundo");

    await contextA.close();
    await contextB.close();
  });

  test("rechaza un token con scope inválido", async ({ browser }) => {
    const room = `doc-${Date.now()}-bad`;
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(fixtureUrl());

    const badToken = jwt.sign(
      { sub: "user-x", docId: room, yDocName: room, scope: "wrong" },
      TEST_COLLAB_SECRET
    );

    // El provider nunca emite 'synced' con un token rechazado → timeout corto.
    const synced = await page
      .evaluate(
        ([u, n, t]: [string, string, string]) =>
          Promise.race([
            window.collabConnect(u, n, t),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000))
          ]),
        [wsUrl(), room, badToken]
      );

    expect(synced).toBe(false);
    await context.close();
  });
});
