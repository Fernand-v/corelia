// Cliente mínimo del harness de colaboración: se compila con esbuild a un bundle
// IIFE (collab.bundle.js) y expone funciones en `window` para que Playwright las
// invoque vía page.evaluate. Ejercita el transporte real (HocuspocusProvider +
// Y.js) sin la app de Next ni la API.
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";

type CollabState = {
  doc: Y.Doc;
  text: Y.Text;
  provider: HocuspocusProvider;
};

declare global {
  interface Window {
    collabConnect: (url: string, name: string, token: string) => Promise<boolean>;
    collabInsert: (value: string) => void;
    collabGet: () => string;
  }
}

let state: CollabState | null = null;

window.collabConnect = (url, name, token) => {
  const doc = new Y.Doc();
  const provider = new HocuspocusProvider({ url, name, token, document: doc });
  state = { doc, text: doc.getText("content"), provider };

  return new Promise<boolean>((resolveSynced) => {
    provider.on("synced", () => resolveSynced(true));
  });
};

window.collabInsert = (value) => {
  if (!state) throw new Error("collabConnect no fue invocado");
  state.text.insert(state.text.length, value);
};

window.collabGet = () => (state ? state.text.toString() : "");
