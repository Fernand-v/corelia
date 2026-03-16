// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "@/components/login-form";

const pushMock = vi.fn();
const setTokensMock = vi.fn();
const apiRequestMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock
  })
}));

vi.mock("@/lib/frontend-settings", () => ({
  useFrontendSettings: () => ({
    settings: {
      organizationName: "Corelia"
    }
  })
}));

vi.mock("@/lib/api", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  useAuthStore: (selector: (state: { setTokens: typeof setTokensMock }) => unknown) =>
    selector({
      setTokens: setTokensMock
    })
}));

const renderWithProviders = (ui: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("inicia sesión y redirige al home", async () => {
    apiRequestMock.mockResolvedValueOnce({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresInSeconds: 900,
      userId: "user-1"
    });

    renderWithProviders(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: {
        value: "  admin@corelia.local  "
      }
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: {
        value: "Admin123!@#"
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@corelia.local",
          password: "Admin123!@#"
        })
      });
    });

    await waitFor(() => {
      expect(setTokensMock).toHaveBeenCalledWith("access-token", "refresh-token");
      expect(pushMock).toHaveBeenCalledWith("/home");
    });
  });

  it("muestra error del backend y lo limpia al editar el formulario", async () => {
    apiRequestMock.mockRejectedValueOnce(new Error("Credenciales inválidas"));

    renderWithProviders(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: {
        value: "admin@corelia.local"
      }
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: {
        value: "Admin123!@#"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Credenciales inválidas")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: {
        value: "owner@corelia.local"
      }
    });

    await waitFor(() => {
      expect(screen.queryByText("Credenciales inválidas")).not.toBeInTheDocument();
    });
  });

  it("permite alternar visibilidad de contraseña", () => {
    renderWithProviders(<LoginForm />);

    const passwordInput = screen.getByLabelText("Contraseña");
    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(passwordInput).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("deshabilita el formulario mientras la solicitud está en curso", async () => {
    const deferredLoginRequest: { resolve: ((value: unknown) => void) | null } = {
      resolve: null
    };
    apiRequestMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          deferredLoginRequest.resolve = resolve;
        })
    );

    renderWithProviders(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: {
        value: "admin@corelia.local"
      }
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: {
        value: "Admin123!@#"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();
      expect(screen.getByLabelText("Email")).toBeDisabled();
      expect(screen.getByLabelText("Contraseña")).toBeDisabled();
    });

    if (!deferredLoginRequest.resolve) {
      throw new Error("No se capturó el resolve de la solicitud de login");
    }

    deferredLoginRequest.resolve({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresInSeconds: 900,
      userId: "user-1"
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/home");
    });
  });
});
