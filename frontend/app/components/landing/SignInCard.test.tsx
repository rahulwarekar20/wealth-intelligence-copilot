/** Tests for the landing-page sign-in form, with the API and router mocked. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInCard from "./SignInCard";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const login = vi.fn();
const signup = vi.fn();
vi.mock("@/lib/api", () => ({
  login: (...args: unknown[]) => login(...args),
  signup: (...args: unknown[]) => signup(...args),
  getErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

function renderCard() {
  render(<SignInCard emailRef={createRef<HTMLInputElement>()} />);
  return userEvent.setup();
}

describe("SignInCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("signs in, stores the token and opens the dashboard", async () => {
    login.mockResolvedValue({ access_token: "tok" });
    const user = renderCard();
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: /^sign in/i }));
    expect(login).toHaveBeenCalledWith("a@b.com", "secret");
    expect(localStorage.getItem("token")).toBe("tok");
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("requires both email and password", async () => {
    const user = renderCard();
    await user.click(screen.getByRole("button", { name: /^sign in/i }));
    expect(screen.getByText("Enter your email and password")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("shows an error and stays on the page when the login is rejected", async () => {
    login.mockRejectedValue(new Error("401"));
    const user = renderCard();
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /^sign in/i }));
    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("enforces an 8-character minimum password when creating an account", async () => {
    const user = renderCard();
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it("fills in the demo credentials when the demo box is clicked", async () => {
    const user = renderCard();
    await user.click(screen.getByRole("button", { name: /demo account/i }));
    expect(screen.getByLabelText("Email")).toHaveValue("test@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("testpass123");
  });
});
