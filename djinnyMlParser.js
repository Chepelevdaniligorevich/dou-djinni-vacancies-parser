const puppeteer = require("puppeteer-core");
const fs = require("fs");

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));
const { Document, Packer, Paragraph, TextRun } = require("docx");

const urls = {
  "djinni-ai/ml-0-1":
    "https://djinni.co/jobs/?primary_keyword=Data+Science&exp_level=no_exp&exp_level=1y",
  "djinni-ai/ml-2-4":
    "https://djinni.co/jobs/?primary_keyword=Data+Science&exp_level=2y&exp_level=3y&exp_level=4y",
  "djinni-ai/ml-5+":
    "https://djinni.co/jobs/?primary_keyword=Data+Science&exp_level=5y&exp_level=6y&exp_level=7y&exp_level=8y&exp_level=9y&exp_level=10y",
};

const getTotalItems = async (page) => {
  const totalItemsText = await page.$eval(
    "h1.mb-0 span.text-muted",
    (el) => el.innerText,
  );
  return parseInt(totalItemsText.trim(), 10);
};

const parsePageLinks = async (page, url) => {
  await page.goto(url, { waitUntil: "load", timeout: 0 });

  const links = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("li.mb-4 h3 a"));
    return items.map((item) => item.href);
  });

  console.log(`Collected ${links.length} links from ${url}`);
  return links;
};

const parseCategory = async (browser, initialUrl, category) => {
  const page = await browser.newPage();
  await page.goto(initialUrl, { waitUntil: "load", timeout: 0 });

  const totalItems = await getTotalItems(page);
  console.log(`Total items: ${totalItems}`);

  const itemsPerPage = 15;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  let allLinks = [];
  for (let i = 1; i <= totalPages; i++) {
    const pageUrl = i === 1 ? initialUrl : `${initialUrl}&page=${i}`;
    const pageLinks = await parsePageLinks(page, pageUrl);
    allLinks.push(...pageLinks);
    await delay(1000);
  }

  await page.close();

  const vacancies = [];

  for (const link of allLinks) {
    const vacancyPage = await browser.newPage();
    await vacancyPage.goto(link, { waitUntil: "load", timeout: 0 });

    const vacancyDetails = await vacancyPage.evaluate(() => {
      const title =
        document.querySelector("h1.d-flex.align-items-center span")
          ?.innerText || "";
      const info =
        document.querySelector(".job-post__description")?.innerText || "";
      const salary =
        document.querySelector("span.text-success.text-nowrap")?.innerText ||
        "";
      return { title, info, salary };
    });

    vacancies.push({ link, ...vacancyDetails });

    await delay(4000);

    await vacancyPage.close();
  }
  console.log("🚀 ~ parseCategory ~ vacancies:", vacancies);

  const sections = vacancies.map((vacancy, index) => ({
    properties: {},
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: `Vacancy ${index + 1}`, bold: true, size: 28 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Link: ${vacancy.link}`, underline: true }),
        ],
      }),
      new Paragraph({
        text: `Title: ${vacancy.title}`,
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: `Info: ${vacancy.info}`,
        spacing: { after: 200 },
      }),
      new Paragraph({
        text: `Description: ${vacancy.salary}`,
        spacing: { after: 400 },
      }),
    ],
  }));

  const doc = new Document({
    creator: "Vacancy Scraper",
    sections,
  });

  const sanitizedCategory = category.replace(/[\/+]/g, "_");
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(`${sanitizedCategory}Vacancies.docx`, buffer);
};

const fireParser = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    defaultViewport: null,
    args: ["--window-size=1920,1080"],
  });

  const page = await browser.newPage();

  await page.goto("https://djinni.co/login?from=frontpage_main", {
    waitUntil: "load",
    timeout: 0,
  });

  await page.type("#email", "darkodonnie528@gmail.com");
  await page.type("#password", "q1q2q3q4");

  await page.waitForSelector(".btn.btn-primary.btn-lg.js-send-btn", {
    visible: true,
  });
  await page.click(".btn.btn-primary.btn-lg.js-send-btn");

  await delay(1000);

  for (const [category, url] of Object.entries(urls)) {
    console.log(`Parsing category: ${category}`);
    await parseCategory(browser, url, category);
  }

  await browser.close();
};

fireParser();
