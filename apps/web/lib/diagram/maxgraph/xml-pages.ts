import type { DrawioDocument, DrawioPage } from "@/lib/diagram/maxgraph/xml-format";

const randomId = (): string => `page-${Math.random().toString(36).slice(2, 10)}`;

const clonePage = (page: DrawioPage): DrawioPage => ({ ...page });

export const getActivePage = (document: DrawioDocument): DrawioPage | null =>
  document.pages.find((page) => page.id === document.activePageId) ?? document.pages[0] ?? null;

export const updatePageXml = (
  document: DrawioDocument,
  pageId: string,
  xml: string
): DrawioDocument => ({
  ...document,
  modified: new Date().toISOString(),
  pages: document.pages.map((page) => (page.id === pageId ? { ...page, xml } : page))
});

export const setActivePage = (document: DrawioDocument, pageId: string): DrawioDocument => {
  const exists = document.pages.some((page) => page.id === pageId);
  if (!exists) {
    return document;
  }

  return {
    ...document,
    activePageId: pageId
  };
};

export const addPage = (
  document: DrawioDocument,
  input: { name: string; xml: string }
): DrawioDocument => {
  const nextPage: DrawioPage = {
    id: randomId(),
    name: input.name,
    xml: input.xml
  };

  return {
    ...document,
    modified: new Date().toISOString(),
    activePageId: nextPage.id,
    pages: [...document.pages, nextPage]
  };
};

export const renamePage = (
  document: DrawioDocument,
  pageId: string,
  name: string
): DrawioDocument => ({
  ...document,
  modified: new Date().toISOString(),
  pages: document.pages.map((page) => (page.id === pageId ? { ...page, name } : page))
});

export const duplicatePage = (document: DrawioDocument, pageId: string): DrawioDocument => {
  const source = document.pages.find((page) => page.id === pageId);
  if (!source) {
    return document;
  }

  const duplicated: DrawioPage = {
    ...clonePage(source),
    id: randomId(),
    name: `${source.name} (copia)`
  };

  return {
    ...document,
    modified: new Date().toISOString(),
    activePageId: duplicated.id,
    pages: [...document.pages, duplicated]
  };
};

export const removePage = (document: DrawioDocument, pageId: string): DrawioDocument => {
  if (document.pages.length <= 1) {
    return document;
  }

  const pages = document.pages.filter((page) => page.id !== pageId);
  const activePageId =
    document.activePageId === pageId ? (pages[0]?.id ?? document.activePageId) : document.activePageId;

  return {
    ...document,
    modified: new Date().toISOString(),
    activePageId,
    pages
  };
};
