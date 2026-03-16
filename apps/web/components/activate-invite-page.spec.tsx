// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActivateInvitePage } from "@/components/activate-invite-page";

const pushMock = vi.fn();
const setTokensMock = vi.fn();
const apiRequestMock = vi.fn();
let currentToken = "invite-token-1234567890";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "token" ? currentToken : null)
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

describe("ActivateInvitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentToken = "invite-token-1234567890";
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra error cuando falta token y bloquea el envío", () => {
    currentToken = "";

    renderWithProviders(<ActivateInvitePage />);

    expect(
      screen.getByText("No se encontró token de invitación en la URL. Solicita un nuevo enlace al administrador.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activar cuenta" })).toBeDisabled();
  });

  it("valida contraseña confirmada antes de llamar al backend", async () => {
    renderWithProviders(<ActivateInvitePage />);

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: {
        value: "Ada"
      }
    });
    fireEvent.change(screen.getByLabelText("Apellido"), {
      target: {
        value: "Lovelace"
      }
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: {
        value: "Admin123!@#"
      }
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: {
        value: "Different123!@#"
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "Activar cuenta" }));

    expect(await screen.findByText("Las contraseñas no coinciden")).toBeInTheDocument();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("activa invitación, guarda tokens y redirige", async () => {
    apiRequestMock.mockResolvedValueOnce({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresInSeconds: 900,
      userId: "user-1"
    });

    renderWithProviders(<ActivateInvitePage />);

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: {
        value: "  Ada  "
      }
    });
    fireEvent.change(screen.getByLabelText("Apellido"), {
      target: {
        value: "  Lovelace  "
      }
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: {
        value: "Admin123!@#"
      }
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: {
        value: "Admin123!@#"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Activar cuenta" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/auth/activate-invite", {
        method: "POST",
        body: JSON.stringify({
          token: "invite-token-1234567890",
          firstName: "Ada",
          lastName: "Lovelace",
          password: "Admin123!@#"
        })
      });
    });

    await waitFor(() => {
      expect(setTokensMock).toHaveBeenCalledWith("access-token", "refresh-token");
      expect(pushMock).toHaveBeenCalledWith("/home");
    });
  });

  it("muestra error del backend y lo limpia al editar campos", async () => {
    apiRequestMock.mockRejectedValueOnce(new Error("Invitación inválida o expirada"));

    renderWithProviders(<ActivateInvitePage />);

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: {
        value: "Ada"
      }
    });
    fireEvent.change(screen.getByLabelText("Apellido"), {
      target: {
        value: "Lovelace"
      }
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: {
        value: "Admin123!@#"
      }
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: {
        value: "Admin123!@#"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Activar cuenta" }));

    expect(await screen.findByText("Invitación inválida o expirada")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Apellido"), {
      target: {
        value: "Byron"
      }
    });

    await waitFor(() => {
      expect(screen.queryByText("Invitación inválida o expirada")).not.toBeInTheDocument();
    });
  });
});
