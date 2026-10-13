import { test, expect } from "@playwright/test";

test("public demonstration opens without accounts and makes no external request", async ({page}, testInfo) => {
  const external:string[]=[];
  const errors:string[]=[];
  page.on("request", request=>{const url=request.url();if(url.startsWith("http") && new URL(url).origin!=="http://127.0.0.1:4173") external.push(url);});
  page.on("pageerror", error=>errors.push(error.message));
  page.on("console", msg=>{if(msg.type()==="error") errors.push(msg.text());});
  await page.addInitScript(()=>{window.__ACREA_FITNESS_ENV__={EXPO_PUBLIC_API_BASE_URL:"https://invalid.example.test",EXPO_PUBLIC_PWA_ANALYTICS_ENDPOINT:"https://invalid.example.test/events"};});
  await page.goto("/home");
  await expect(page.getByText("ACREA Fitness — Démonstration",{exact:true})).toBeVisible();
  await expect(page.getByPlaceholder("email")).toHaveCount(0);
  await expect(page.getByPlaceholder("mot de passe")).toHaveCount(0);
  await page.getByRole("button",{name:"Continuer en session locale"}).click();
  await expect(page.getByText("Accueil",{exact:true}).last()).toBeVisible();
  await page.goto("/bibliotheque");
  await expect(page.getByText("Burpee",{exact:true}).first()).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("demo-desktop.png"),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole("button",{name:"Ouvrir le menu"})).toBeVisible();
  await page.getByRole("button",{name:"Ouvrir le menu"}).click();
  await page.getByRole("button",{name:"Minuteur",exact:true}).click();
  await expect(page).toHaveURL(/\/timer$/);
  await expect(page.getByRole("button",{name:"Démarrer",exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("demo-mobile.png"),fullPage:false});
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
