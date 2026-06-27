import { describe, expect, it } from "vitest";
import { socketHasPermission } from "../plugins/socket/access.js";
import type { SocketWithUser } from "../plugins/socket/types.js";

const fakeSocket = (permissions: string[]): SocketWithUser =>
  ({ data: { user: { id: "u-1", email: "u@x.io", permissions, programs: [] } } }) as unknown as SocketWithUser;

describe("socketHasPermission", () => {
  it("permite cuando el rol tiene la key recurso_accion", () => {
    const socket = fakeSocket(["LLAMADA_ACCEDER", "MENSAJE_ESCRIBIR"]);
    expect(socketHasPermission(socket, "LLAMADA", "ACCEDER")).toBe(true);
    expect(socketHasPermission(socket, "MENSAJE", "ESCRIBIR")).toBe(true);
  });

  it("niega cuando falta el permiso", () => {
    const socket = fakeSocket(["MENSAJE_ESCRIBIR"]);
    expect(socketHasPermission(socket, "LLAMADA", "ACCEDER")).toBe(false);
  });

  it("niega con permisos vacíos", () => {
    expect(socketHasPermission(fakeSocket([]), "LLAMADA", "ACCEDER")).toBe(false);
  });
});
