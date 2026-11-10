import { expect, test, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

async function login(page: Page) {
  const sessionToken = await encode({
    token: { sub: "demo-user", authVersion: 0, name: "郑宇豪", email: "demo@campuspulse.local" },
    secret: "playwright-test-secret",
    maxAge: 3600,
  });
  await page.context().addCookies([{ name: "next-auth.session-token", value: sessionToken, url: "http://127.0.0.1:3390" }]);
  await page.goto("/dashboard");
  await expect(page.locator(".app-shell")).toBeVisible();
}

test("workspace pages fit mobile and tablet widths with reachable navigation", async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "demo-user", name: "郑宇豪", email: "demo@campuspulse.local" }, expires: "2099-01-01T00:00:00.000Z" }) }));
  await page.route("**/api/datasets/mobile-sample", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ dataset: { id: "mobile-sample", name: "移动端检查数据集", description: "用于验证小屏数据表格与字段详情。", rowCount: 2, columnCount: 3, healthScore: 96, sourceType: "CSV", status: "READY", updatedAt: "2026-11-10T00:00:00.000Z", evidence: [{ kind: "STRUCTURED", content: { columns: ["活动名称", "报名人数", "签到人数"], rows: [{ "活动名称": "校园文化节", "报名人数": 128, "签到人数": 97 }, { "活动名称": "社团招新", "报名人数": 86, "签到人数": 72 }], dictionary: [{ field: "活动名称", meaning: "校园活动标题", type: "text" }], profile: { missingCells: 0, numericColumns: ["报名人数", "签到人数"] }, duplicates: 0 } }] } }) }));
  await login(page);

  for (const width of [320, 360, 390, 430, 768, 820, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });

    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "数据空间" })).toBeVisible();
    await page.getByRole("button", { name: "数据空间" }).click();
    await expect(page).toHaveURL(/\/datasets$/);

    for (const route of ["/dashboard", "/datasets", "/datasets/mobile-sample", "/analysis", "/canvas", "/reports", "/settings", "/admin"]) {
      await page.goto(route);
      await expect(page.locator(".app-shell")).toBeVisible();
      await page.evaluate(async () => {
        const finiteAnimations = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
        await Promise.all(finiteAnimations.map((animation) => animation.finished.catch(() => undefined)));
      });
      if (route === "/canvas") await expect(page.locator(".board-chart canvas")).toBeVisible();
      await expect(page.locator(".sidebar .nav-list .nav-item")).toHaveCount(6);
      await expect(page.locator(".main-area")).toBeVisible();
      await expect(page.locator(".sidebar .nav-item span").first()).toBeVisible();

      const metrics = await page.evaluate(() => {
        const sidebar = document.querySelector(".sidebar");
        const firstNavLabel = document.querySelector(".sidebar .nav-item span");
        const layoutElements = [...document.querySelectorAll(".app-shell, .sidebar, .main-area, .content, .grid, .topbar, .reports-layout, .analysis-layout, .canvas-layout, .settings-grid, .admin-section, .detail-hero, .data-table-wrap, .chart-wrap, .board-chart, .admin-table, .page-toolbar, .canvas-toolbar, .workspace-controls")];
        const sidebarRect = sidebar?.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          sidebarPosition: sidebar ? getComputedStyle(sidebar).position : "missing",
          sidebarBottom: sidebarRect?.bottom ?? 0,
          sidebarLeft: sidebarRect?.left ?? 0,
          navigationLabelDisplay: firstNavLabel ? getComputedStyle(firstNavLabel).display : "missing",
          navigationLabels: [...document.querySelectorAll(".sidebar .nav-item span")].map((element) => {
            const styles = getComputedStyle(element);
            return {
              text: element.textContent?.trim() ?? "",
              whiteSpace: styles.whiteSpace,
              textOverflow: styles.textOverflow,
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
            };
          }),
          overflowingLayouts: layoutElements.filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1).map((element) => element.className),
          overflowingElements: [...document.querySelectorAll("body *")].filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1 && element.getBoundingClientRect().width > 0).map((element) => ({ tag: element.tagName, className: typeof element.className === "string" ? element.className : "", right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflow: getComputedStyle(element).overflowX })).sort((first, second) => second.right - first.right).slice(0, 15),
        };
      });

      expect(metrics.documentWidth, `${route} overflows at ${width}px: ${JSON.stringify(metrics.overflowingElements)}`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.overflowingLayouts, `${route} layout escapes the viewport at ${width}px`).toEqual([]);
      if (width <= 760) {
        expect(metrics.sidebarPosition).toBe("fixed");
        expect(metrics.sidebarBottom).toBeGreaterThanOrEqual(843);
      } else {
        expect(metrics.sidebarLeft).toBe(0);
      }
      expect(metrics.navigationLabelDisplay).not.toBe("none");
      if (width <= 430) {
        expect(metrics.navigationLabels, `navigation labels should remain readable at ${width}px`).toHaveLength(6);
        expect(metrics.navigationLabels.filter((label) => label.whiteSpace === "nowrap" || label.textOverflow === "ellipsis" || label.scrollHeight > label.clientHeight + 1), `navigation labels should wrap instead of truncating at ${width}px`).toEqual([]);
      }
      if (route === "/admin" && width <= 430) {
        const adminTabs = await page.locator(".admin-tabs").evaluate((element) => ({
          flexWrap: getComputedStyle(element).flexWrap,
          buttons: [...element.querySelectorAll(".admin-tab")].map((button) => ({
            right: button.getBoundingClientRect().right,
            left: button.getBoundingClientRect().left,
            minHeight: Number.parseFloat(getComputedStyle(button).minHeight),
            whiteSpace: getComputedStyle(button).whiteSpace,
          })),
        }));
        expect(adminTabs.flexWrap).toBe("wrap");
        expect(adminTabs.buttons.length).toBeGreaterThanOrEqual(5);
        expect(adminTabs.buttons.filter((button) => button.left < -1 || button.right > width + 1 || button.minHeight < 44 || button.whiteSpace !== "normal"), `admin tabs should wrap without clipping at ${width}px`).toEqual([]);
      }
      if (route === "/settings" && width >= 761 && width <= 1120) {
        const columns = await page.locator(".settings-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
        expect(columns, `settings cards should stack when the workspace is narrow at ${width}px`).toBe(1);
        const cardMinHeight = await page.locator(".settings-grid > .settings-card").first().evaluate((element) => Number.parseFloat(getComputedStyle(element).minHeight));
        expect(cardMinHeight, `stacked settings cards should not retain desktop minimum height at ${width}px`).toBe(0);
      }
      if (route === "/datasets/mobile-sample") await expect(page.locator(".data-table-wrap")).toBeVisible();
      if (width === 390 && (route === "/dashboard" || route === "/admin")) {
        await page.screenshot({ path: `test-results/${route.slice(1)}-390.png`, fullPage: true });
      }
      if (width === 1440 && ["/dashboard", "/analysis", "/canvas", "/reports", "/admin", "/settings"].includes(route)) {
        await page.screenshot({ path: `test-results/${route.slice(1)}-1440.png`, fullPage: true });
      }
      if (width === 1440 && route === "/datasets/mobile-sample") {
        await page.screenshot({ path: "test-results/dataset-detail-1440.png", fullPage: true });
      }
      if (width === 1024 && ["/dashboard", "/canvas", "/reports", "/admin", "/settings"].includes(route)) {
        await page.screenshot({ path: `test-results/${route.slice(1)}-1024.png`, fullPage: true });
      }
    }
  }
});

test("landing and account forms remain usable on narrow screens", async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/auth/features", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ passwordLogin: true, phoneLogin: false, emailVerification: true, registrationEnabled: true, smsEnabled: false, githubLogin: false, site: { name: "CampusPulse AI" } }) }));

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });

    for (const route of ["/", "/login", "/register", "/reset-password"]) {
      await page.goto(route);
      if (route !== "/") await expect(page.locator(".auth-card")).toBeVisible();
      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        card: document.querySelector(".auth-card")?.getBoundingClientRect().toJSON(),
        touchTargets: [...document.querySelectorAll(".auth-card button, .auth-card a:not(.auth-brand), .auth-card input:not([type='hidden'])")].map((element) => ({ name: element.getAttribute("aria-label") || element.textContent?.trim() || (element instanceof HTMLInputElement ? element.placeholder : "input"), height: element.getBoundingClientRect().height })),
        overflowingContent: [...document.querySelectorAll(".auth-page, .auth-card, .auth-card *")].filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1).map((element) => ({ tag: element.tagName, className: typeof element.className === "string" ? element.className : "", right: Math.round(element.getBoundingClientRect().right) })),
      }));
      expect(layout.document, `${route} overflows at ${width}px`).toBeLessThanOrEqual(layout.viewport + 1);
      if (layout.card) {
        expect(layout.card.left).toBeGreaterThanOrEqual(-1);
        expect(layout.card.right).toBeLessThanOrEqual(width + 1);
        expect(layout.overflowingContent, `${route} content escapes the viewport at ${width}px`).toEqual([]);
        expect(layout.touchTargets.filter((target) => target.height > 0 && target.height < 44), `${route} has undersized touch targets at ${width}px`).toEqual([]);
        if (width === 390 && route === "/login") await page.screenshot({ path: "test-results/login-390.png", fullPage: true });
      }
    }
  }
});
