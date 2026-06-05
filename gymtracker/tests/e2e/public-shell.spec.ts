import { expect, test } from "@playwright/test";

test.describe("public experience", () => {
  test("landing page shows the premium shell and main actions", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Um app para levar o seu acompanhamento al\u00e9m da planilha.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Entrar" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Privacidade" }),
    ).toBeVisible();
  });

  test("login page loads with the new form shell", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "GymTracker" }).last()).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Entrar" }),
    ).toBeVisible();
  });
});
