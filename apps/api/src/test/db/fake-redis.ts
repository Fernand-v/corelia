// Redis en memoria mínimo para los tests DB: cubre los comandos que usan las
// rutas bajo prueba (get/set/del/incr/expire). No implementa TTL real — basta
// para validar el camino de caché y su invalidación.
export class FakeRedis {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.store.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const next = Number(this.store.get(key) ?? 0) + 1;
    this.store.set(key, String(next));
    return next;
  }

  async expire(): Promise<number> {
    return 1;
  }

  clear(): void {
    this.store.clear();
  }
}
